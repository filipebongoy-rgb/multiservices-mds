import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Request } from "express";
import Stripe from "stripe";
import { z } from "zod";
import * as s from "../../drizzle/schema";
import { trackSchema } from "../../shared/mds";
import { router } from "../_core/trpc";
import {
  authenticated,
  authorizeRequest,
  dbRequired,
  hash,
  principal,
  procedure,
  recordAudit,
  requestFilter,
  type Identity,
  type SqlDb,
} from "./common";
import { fail } from "./workflow";
import {
  settlementProcedures,
  stageFor,
  stageProcedures,
} from "./payment-stages";
import { refundProcedures } from "./refunds";
export { commercialPaidCents } from "./payment-stages";

export type StripeMode = "test" | "live";
export type Payment = typeof s.payments.$inferSelect;

// Credentials are read at use time, never exported to a caller or logged.
export function paymentConfig(): {
  enabled: boolean;
  mode: StripeMode | "unavailable";
} {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const mode = key.startsWith("sk_test_")
    ? "test"
    : key.startsWith("sk_live_")
      ? "live"
      : "unavailable";
  return {
    enabled:
      mode !== "unavailable" &&
      !!process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_"),
    mode,
  };
}
export function stripeRequired(): { stripe: Stripe; mode: StripeMode } {
  const config = paymentConfig();
  if (!config.enabled || config.mode === "unavailable")
    fail("Le paiement en ligne n’est pas disponible actuellement.", "CONFLICT");
  return {
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY!, {
      maxNetworkRetries: 2,
      timeout: 20000,
    }),
    mode: config.mode,
  };
}

function exactOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail("L’origine de retour du paiement est invalide.");
  }
  if (url.origin !== value || url.username || url.password)
    fail("Indiquez uniquement l’origine exacte de cette application.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      local &&
      process.env.NODE_ENV !== "production"
    )
  )
    fail("Le retour de paiement exige HTTPS (ou localhost en développement).");
  return url.origin;
}
export function validateCheckoutOrigin(
  value: string,
  req: Pick<Request, "headers">
) {
  const origin = exactOrigin(value);
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  let callerOrigin: string | undefined;
  if (typeof originHeader === "string") {
    try {
      callerOrigin = exactOrigin(originHeader);
    } catch {
      fail("L’origine du navigateur est invalide.", "FORBIDDEN");
    }
  } else if (typeof refererHeader === "string") {
    try {
      const ref = new URL(refererHeader);
      if (ref.username || ref.password)
        fail("Le navigateur ne fournit pas une origine valide.", "FORBIDDEN");
      callerOrigin = ref.origin;
    } catch {
      fail("Le navigateur ne fournit pas une origine valide.", "FORBIDDEN");
    }
  }
  // Host and X-Forwarded-Host are intentionally not used: they can be internal or spoofed.
  const configured =
    process.env.MDS_PUBLIC_ORIGIN || process.env.PUBLIC_APP_ORIGIN;
  if (configured && exactOrigin(configured) !== origin)
    fail(
      "Le retour doit rester sur l’origine publique configurée.",
      "FORBIDDEN"
    );
  if (callerOrigin !== origin)
    fail(
      "L’origine de retour doit correspondre à celle du navigateur.",
      "FORBIDDEN"
    );
  return origin;
}

export const publicPaymentFields = {
  id: s.payments.id,
  provider: s.payments.provider,
  mode: s.payments.mode,
  status: s.payments.status,
  amountCents: s.payments.amountCents,
  receivedAmountCents: s.payments.receivedAmountCents,
  creditedAt: s.payments.creditedAt,
  purpose: s.payments.purpose,
  planId: s.payments.planId,
  currency: s.payments.currency,
  reference: s.payments.reference,
  expiresAt: s.payments.expiresAt,
  confirmedAt: s.payments.confirmedAt,
  createdAt: s.payments.createdAt,
  updatedAt: s.payments.updatedAt,
};
async function loadRequest(db: SqlDb, reference: string, lock = false) {
  const query = db
    .select()
    .from(s.requests)
    .where(eq(s.requests.reference, reference));
  const [request] = await (lock ? query.for("update") : query);
  if (!request) fail("Cette demande est introuvable.", "NOT_FOUND");
  return request;
}
const bounded = (value: string | null | undefined) =>
  value?.trim().slice(0, 255) || "";
function checkoutParameters(
  request: s.MdsRequest,
  payment: Pick<Payment, "amountCents" | "expiresAt">,
  origin: string,
  user: Identity
): Stripe.Checkout.SessionCreateParams {
  const email =
    user?.id && user.email ? user.email.trim() : request.email.trim();
  const metadata = {
    request_id: String(request.id),
    invoice_id: "",
    payment_id: "",
    checkout_key: "",
    ...(user?.id ? { user_id: String(user.id) } : {}),
    customer_email: bounded(email),
    customer_name: bounded(user?.id ? user.name || request.name : request.name),
  };
  const query = `ref=${encodeURIComponent(request.reference)}`;
  return {
    mode: "payment",
    allow_promotion_codes: true,
    client_reference_id: request.reference,
    customer_email: email,
    success_url: `${origin}/paiements?${query}&checkout=retour`,
    cancel_url: `${origin}/paiements?${query}&checkout=annule`,
    expires_at: Math.floor(payment.expiresAt!.getTime() / 1000),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: payment.amountCents,
          product_data: {
            name: `Facture ${request.reference}`,
            description: bounded(
              request.serviceName || "Intervention MULTISERVICES MDS"
            ),
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata: { ...metadata } },
  };
}
function parameterFingerprint(params: Stripe.Checkout.SessionCreateParams) {
  return hash(JSON.stringify(params)).slice(0, 32);
}
function completeParameters(
  params: Stripe.Checkout.SessionCreateParams,
  payment: Payment
) {
  const metadata = {
    ...params.metadata,
    invoice_id: payment.invoiceId == null ? "" : String(payment.invoiceId),
    plan_id: payment.planId == null ? "" : String(payment.planId),
    purpose: payment.purpose || "full",
    payment_id: String(payment.id),
    checkout_key: payment.checkoutKey!,
  };
  return { ...params, metadata, payment_intent_data: { metadata } };
}
export function providerId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || null;
}
const subscriptionPlans = {
  artisan_monthly: "price_1Ua2TdRsH5ZKkWjnwsHEPsFd",
  artisan_yearly: "price_1Ua2TdRsH5ZKkWjnUa66UHZH",
  property_monthly: "price_1Ua2TdRsH5ZKkWjnJv53dJxV",
  property_yearly: "price_1Ua2TdRsH5ZKkWjniQULXnmY",
} as const;
function validSession(
  session: Stripe.Checkout.Session,
  payment: Payment,
  request: s.MdsRequest
) {
  const md = session.metadata;
  return (
    session.id.startsWith("cs_") &&
    session.mode === "payment" &&
    session.livemode === (payment.mode === "live") &&
    session.client_reference_id === request.reference &&
    md?.payment_id === String(payment.id) &&
    md.invoice_id ===
      (payment.invoiceId == null ? "" : String(payment.invoiceId)) &&
    (md.purpose ?? "full") === (payment.purpose || "full") &&
    (md.plan_id ?? "") ===
      (payment.planId == null ? "" : String(payment.planId)) &&
    md.request_id === String(payment.requestId) &&
    md.checkout_key === payment.checkoutKey
  );
}
function checkoutUrl(session: Stripe.Checkout.Session) {
  if (!session.url)
    fail(
      "Le paiement est en cours de vérification. Actualisez le dossier, sans lancer de nouveau règlement.",
      "CONFLICT"
    );
  let url: URL;
  try {
    url = new URL(session.url);
  } catch {
    fail("Le lien Stripe n’est pas disponible.", "CONFLICT");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.stripe.com" ||
    url.username ||
    url.password
  )
    fail("Le lien Stripe reçu est invalide.", "CONFLICT");
  return session.url;
}

export const paymentsRouter = router({
  ...stageProcedures,
  ...settlementProcedures,
  ...refundProcedures,
  config: procedure.query(() => paymentConfig()),
  list: procedure.input(trackSchema).query(async ({ input, ctx }) => {
    const db = await dbRequired();
    const request = await loadRequest(db, input.reference);
    await authorizeRequest(db, request, ctx.user, input.token);
    return db
      .select(publicPaymentFields)
      .from(s.payments)
      .where(eq(s.payments.requestId, request.id))
      .orderBy(desc(s.payments.createdAt), desc(s.payments.id));
  }),
  mine: authenticated.query(async ({ ctx }) => {
    const db = await dbRequired();
    return db
      .select({
        ...publicPaymentFields,
        requestReference: s.requests.reference,
        serviceName: s.requests.serviceName,
      })
      .from(s.payments)
      .innerJoin(s.requests, eq(s.requests.id, s.payments.requestId))
      .where(await requestFilter(db, ctx.user))
      .orderBy(desc(s.payments.createdAt), desc(s.payments.id));
  }),
  subscriptionCheckout: authenticated
    .input(
      z.object({
        plan: z.enum([
          "artisan_monthly",
          "artisan_yearly",
          "property_monthly",
          "property_yearly",
        ]),
        origin: z.string().url().max(2048),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.accountType !== "professional")
        fail("Créez ou utilisez un compte professionnel avant de souscrire.", "FORBIDDEN");
      if (!ctx.user.email) fail("Ajoutez une adresse e-mail à votre compte avant de souscrire.");
      const origin = validateCheckoutOrigin(input.origin, ctx.req);
      const { stripe, mode } = stripeRequired();
      if (mode !== "live") fail("Les abonnements sont disponibles uniquement en mode LIVE.", "CONFLICT");
      const db = await dbRequired();
      const metadata = {
        mds_plan: input.plan,
        user_id: String(ctx.user.id),
        customer_email: bounded(ctx.user.email),
      };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          line_items: [{ price: subscriptionPlans[input.plan], quantity: 1 }],
          customer_email: ctx.user.email,
          success_url: `${origin}/professionnels?subscription=success&plan=${encodeURIComponent(input.plan)}`,
          cancel_url: `${origin}/professionnels?subscription=annule`,
          client_reference_id: `mds-${ctx.user.id}-${input.plan}`,
          metadata,
          subscription_data: { metadata },
          allow_promotion_codes: true,
        },
        { idempotencyKey: `mds-subscription-${ctx.user.id}-${input.plan}-${randomUUID()}` }
      );
      if (!session.url) fail("Stripe n’a pas fourni de lien de souscription.", "CONFLICT");
      await recordAudit(db, ctx.user.id, `subscription.checkout.${mode}`, "user", ctx.user.id);
      return { url: session.url, plan: input.plan };
    }),
  checkout: procedure
    .input(
      trackSchema.extend({
        origin: z.string().url().max(2048),
        purpose: z.enum(["full", "deposit", "balance"]).default("full"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const origin = validateCheckoutOrigin(input.origin, ctx.req);
      const { stripe, mode } = stripeRequired();
      const db = await dbRequired();
      const user = ctx.user && ctx.user.id > 0 ? ctx.user : null;
      // Reserve under the same principal lock as invoice/manual-payment mutations. No Stripe call in this transaction.
      const reserved = await db.transaction(async tx => {
        await principal(tx, true);
        const request = await loadRequest(tx, input.reference, true);
        await authorizeRequest(tx, request, user, input.token);
        const [rawInvoice] = await tx
          .select()
          .from(s.invoices)
          .where(eq(s.invoices.requestId, request.id))
          .for("update");
        const stage = await stageFor(tx, request, rawInvoice, input.purpose);
        const history = await tx
          .select()
          .from(s.payments)
          .where(
            and(
              eq(s.payments.requestId, request.id),
              eq(s.payments.provider, "stripe"),
              eq(s.payments.mode, mode)
            )
          )
          .orderBy(desc(s.payments.id))
          .for("update");
        if (
          history.some(
            p =>
              p.status === "succeeded" &&
              (mode === "live"
                ? !p.creditedAt
                : (p.purpose || "full") === input.purpose &&
                  p.planId == stage.planId)
          )
        )
          fail(
            mode === "test"
              ? "Cette facture possède déjà un paiement test réussi. Aucun encaissement réel n’a été enregistré."
              : "Un paiement reçu attend déjà sa prise en compte. Contactez MDS avant un nouveau règlement.",
            "CONFLICT"
          );
        const existing = history.find(p =>
          ["pending", "failed"].includes(p.status)
        );
        if (existing) {
          if (
            existing.amountCents !== stage.amountCents ||
            existing.currency !== "EUR" ||
            (existing.purpose || "full") !== input.purpose ||
            existing.planId != stage.planId ||
            existing.invoiceId !== stage.invoiceId
          )
            fail(
              "La facture a changé pendant le paiement. MDS doit vérifier la session existante avant tout nouveau règlement.",
              "CONFLICT"
            );
          const params = checkoutParameters(request, existing, origin, user);
          if (
            !existing.checkoutSessionId &&
            !existing.checkoutKey?.endsWith(parameterFingerprint(params))
          )
            fail(
              "Une session est déjà réservée depuis un autre contexte. Reprenez le paiement depuis le navigateur et l’identité d’origine.",
              "CONFLICT"
            );
          if (
            !existing.checkoutSessionId &&
            (!existing.expiresAt ||
              existing.expiresAt.getTime() <= Date.now() + 30000)
          )
            fail(
              "La création de session doit être rapprochée par MDS avant un nouvel essai. Aucun second paiement n’est lancé.",
              "CONFLICT"
            );
          return {
            payment: existing,
            request,
            params: completeParameters(params, existing),
          };
        }
        const expiresAt = new Date(Math.floor(Date.now() / 1000 + 3600) * 1000);
        const base = { amountCents: stage.amountCents, expiresAt };
        const params = checkoutParameters(request, base, origin, user);
        const checkoutKey = `mds-v1-${randomUUID()}-${parameterFingerprint(params)}`;
        const [created] = await tx
          .insert(s.payments)
          .values({
            requestId: request.id,
            invoiceId: stage.invoiceId,
            planId: stage.planId,
            purpose: input.purpose,
            provider: "stripe",
            mode,
            status: "pending",
            amountCents: stage.amountCents,
            currency: "EUR",
            checkoutKey,
            reference: `MDS-P-${randomUUID().slice(0, 18).toUpperCase()}`,
            expiresAt,
          })
          .$returningId();
        const [payment] = await tx
          .select()
          .from(s.payments)
          .where(eq(s.payments.id, created.id));
        await recordAudit(
          tx,
          user?.id || null,
          `payment.checkout.reserve.${mode}`,
          "payment",
          payment.id
        );
        return {
          payment,
          request,
          params: completeParameters(params, payment),
        };
      });
      if (
        mode === "live" &&
        process.env.NODE_ENV === "production" &&
        (!ctx.user || ctx.user.id <= 0)
      )
        fail(
          "Un compte authentifié est obligatoire avant tout paiement sécurisé.",
          "UNAUTHORIZED"
        );
      let session: Stripe.Checkout.Session;
      try {
        session = reserved.payment.checkoutSessionId
          ? await stripe.checkout.sessions.retrieve(
              reserved.payment.checkoutSessionId
            )
          : await stripe.checkout.sessions.create(reserved.params, {
              idempotencyKey: reserved.payment.checkoutKey!,
            });
      } catch {
        // Ambiguous timeout/error MUST retain the reservation/key, even when the network created the session.
        fail(
          "Stripe n’a pas confirmé la session. Réessayez depuis le même navigateur : la réservation existante sera réutilisée, sans nouveau règlement.",
          "CONFLICT"
        );
      }
      if (!validSession(session, reserved.payment, reserved.request))
        fail(
          "La session Stripe ne correspond pas à la réservation. Contactez MDS.",
          "CONFLICT"
        );
      const persisted = await db.transaction(async tx => {
        await principal(tx, true);
        const request = await loadRequest(tx, input.reference, true);
        await authorizeRequest(tx, request, user, input.token);
        const [invoice] = await tx
          .select()
          .from(s.invoices)
          .where(eq(s.invoices.requestId, request.id))
          .for("update");
        const [payment] = await tx
          .select()
          .from(s.payments)
          .where(eq(s.payments.id, reserved.payment.id))
          .for("update");
        const intentId = providerId(session.payment_intent);
        if (
          (payment.checkoutSessionId &&
            payment.checkoutSessionId !== session.id) ||
          (payment.paymentIntentId &&
            intentId &&
            payment.paymentIntentId !== intentId)
        )
          fail(
            "Les identifiants Stripe divergent. MDS doit vérifier ce paiement.",
            "CONFLICT"
          );
        const patch: Partial<typeof s.payments.$inferInsert> = {
          checkoutSessionId: session.id,
          ...(intentId ? { paymentIntentId: intentId } : {}),
          expiresAt: new Date(session.expires_at * 1000),
        };
        if (session.status === "expired" && payment.status !== "succeeded")
          patch.status = "expired";
        await tx
          .update(s.payments)
          .set(patch)
          .where(eq(s.payments.id, payment.id));
        // Provider IDs remain saved even if the invoice was paid/cancelled while the network was in flight.
        let allowed = false;
        try {
          const now = await stageFor(
            tx,
            request,
            invoice,
            payment.purpose || "full"
          );
          allowed =
            now.amountCents === payment.amountCents &&
            now.invoiceId === payment.invoiceId &&
            now.planId == payment.planId &&
            payment.status !== "succeeded";
        } catch {
          /* IDs remain persisted; changed commercial context cannot deliver the link. */
        }
        return { allowed, payment: { ...payment, ...patch } as Payment };
      });
      if (!persisted.allowed)
        fail(
          "Le dossier a changé ou un paiement est déjà reçu. Actualisez le suivi avant de continuer.",
          "CONFLICT"
        );
      if (session.status === "expired")
        fail(
          "La session Stripe a expiré. Vous pouvez relancer le paiement.",
          "CONFLICT"
        );
      if (session.status !== "open")
        fail(
          "Stripe traite ce paiement. Le retour du navigateur ne vaut pas confirmation : attendez la vérification signée.",
          "CONFLICT"
        );
      return { url: checkoutUrl(session), mode };
    }),
});
