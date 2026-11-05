import { eq } from "drizzle-orm";
import { z } from "zod";
import type Stripe from "stripe";
import * as s from "../../drizzle/schema";
import {
  artisan,
  dbRequired,
  event,
  hash,
  principal,
  recordAudit,
  type SqlDb,
} from "./common";
import { providerId, stripeRequired, type Payment } from "./payments";
import { commercialPaidCents } from "./payment-stages";
import { fail } from "./workflow";

type Refund = typeof s.refunds.$inferSelect;
const paymentInput = z.object({ paymentId: z.number().int().positive() });
async function loadPayment(db: SqlDb, id: number) {
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, id));
  if (!p) fail("Ce paiement est introuvable.", "NOT_FOUND");
  if (
    p.provider !== "stripe" ||
    !["live", "test"].includes(p.mode) ||
    p.status !== "succeeded" ||
    !p.paymentIntentId
  )
    fail(
      "Seul un versement Stripe confirmé peut être remboursé ici.",
      "CONFLICT"
    );
  return p;
}
async function funds(stripe: Stripe, mode: "live" | "test", p: Payment) {
  if (p.mode !== mode)
    fail(
      "Les clés Stripe actives ne correspondent pas au mode de ce paiement.",
      "CONFLICT"
    );
  let intent: Stripe.PaymentIntent;
  let list: Stripe.ApiList<Stripe.Refund>;
  try {
    intent = await stripe.paymentIntents.retrieve(p.paymentIntentId!);
    list = await stripe.refunds.list({
      payment_intent: p.paymentIntentId!,
      limit: 100,
    });
  } catch {
    fail(
      "Stripe n’a pas confirmé les fonds disponibles. Aucun remboursement lancé.",
      "CONFLICT"
    );
  }
  if (
    intent.id !== p.paymentIntentId ||
    intent.object !== "payment_intent" ||
    intent.livemode !== (mode === "live") ||
    intent.status !== "succeeded" ||
    intent.currency !== "eur" ||
    !Number.isSafeInteger(intent.amount_received) ||
    intent.amount_received <= 0 ||
    list.has_more ||
    (p.creditedAt && intent.amount_received !== p.receivedAmountCents)
  )
    fail("La preuve des fonds Stripe nécessite un rapprochement.", "CONFLICT");
  if (
    list.data.some(
      r =>
        providerId(r.payment_intent) !== p.paymentIntentId ||
        r.currency !== "eur" ||
        !Number.isSafeInteger(r.amount) ||
        r.amount < 0
    )
  )
    fail("Le registre fournisseur des remboursements diverge.", "CONFLICT");
  const used = list.data
    .filter(r => !["failed", "canceled"].includes(r.status || "pending"))
    .reduce((n, r) => n + r.amount, 0);
  return {
    received: intent.amount_received,
    providerRemaining: Math.max(0, intent.amount_received - used),
  };
}
function occupied(rows: Refund[]) {
  return rows
    .filter(r => ["pending", "succeeded"].includes(r.status))
    .reduce((n, r) => n + r.amountCents, 0);
}
function safeRefund(r: Refund) {
  return {
    id: r.id,
    paymentId: r.paymentId,
    amountCents: r.amountCents,
    currency: r.currency,
    mode: r.mode,
    status: r.status,
    reason: r.reason,
    confirmedAt: r.confirmedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
async function applyRefund(
  db: Awaited<ReturnType<typeof dbRequired>>,
  reserved: Refund,
  p: Payment,
  stripe: Stripe,
  mode: "test" | "live",
  providerRefundId: string
) {
  let proof: Stripe.Refund;
  let intent: Stripe.PaymentIntent;
  try {
    proof = await stripe.refunds.retrieve(providerRefundId);
    intent = await stripe.paymentIntents.retrieve(p.paymentIntentId!);
  } catch {
    fail(
      "Le remboursement reste en attente de relecture Stripe. Ne lancez pas une autre opération.",
      "CONFLICT"
    );
  }
  // Refund has no livemode field: mode is proven by its exact PaymentIntent retrieved with the active scoped key.
  if (
    proof.object !== "refund" ||
    proof.id !== providerRefundId ||
    !proof.id.startsWith("re_") ||
    providerId(proof.payment_intent) !== p.paymentIntentId ||
    proof.amount !== reserved.amountCents ||
    proof.currency !== "eur" ||
    intent.id !== p.paymentIntentId ||
    intent.livemode !== (mode === "live") ||
    intent.currency !== "eur" ||
    intent.status !== "succeeded" ||
    !Number.isSafeInteger(intent.amount_received) ||
    intent.amount_received < proof.amount ||
    (p.creditedAt && intent.amount_received !== p.receivedAmountCents)
  )
    fail(
      "La preuve Stripe du remboursement diverge ; rapprochement requis.",
      "CONFLICT"
    );
  const status: Refund["status"] =
    proof.status === "succeeded"
      ? "succeeded"
      : proof.status === "failed"
        ? "failed"
        : proof.status === "canceled"
          ? "cancelled"
          : "pending";
  return db.transaction(async tx => {
    await principal(tx, true);
    const [row] = await tx
      .select()
      .from(s.refunds)
      .where(eq(s.refunds.id, reserved.id))
      .for("update");
    const current = await loadPayment(tx, p.id);
    if (
      !row ||
      row.paymentId !== p.id ||
      row.amountCents !== proof.amount ||
      row.mode !== mode ||
      (row.providerRefundId && row.providerRefundId !== proof.id) ||
      current.paymentIntentId !== intent.id ||
      (current.creditedAt &&
        current.receivedAmountCents !== intent.amount_received)
    )
      fail("La réservation de remboursement a changé.", "CONFLICT");
    if (row.status === "succeeded") return safeRefund(row);
    const confirmedAt = status === "succeeded" ? new Date() : null;
    await tx
      .update(s.refunds)
      .set({ providerRefundId: proof.id, status, confirmedAt })
      .where(eq(s.refunds.id, row.id));
    await tx
      .update(s.payments)
      .set({ receivedAmountCents: intent.amount_received })
      .where(eq(s.payments.id, p.id));
    const [r] = await tx
      .select()
      .from(s.requests)
      .where(eq(s.requests.id, p.requestId))
      .for("update");
    if (status === "succeeded" && r) {
      let next = r.status;
      if (mode === "live" && current.creditedAt) {
        const [invoice] = await tx
          .select()
          .from(s.invoices)
          .where(eq(s.invoices.requestId, r.id))
          .for("update");
        if (
          invoice?.paidAt &&
          invoice.amountCents != null &&
          (await commercialPaidCents(tx, r.id)) < invoice.amountCents
        ) {
          await tx
            .update(s.invoices)
            .set({
              paidAt: null,
              paymentVerifiedBy: null,
              verificationNote:
                "Acquittement révoqué après remboursement Stripe confirmé.",
            })
            .where(eq(s.invoices.id, invoice.id));
          if (["paid", "closed"].includes(r.status)) next = "invoiced";
        }
      }
      await tx
        .update(s.requests)
        .set({
          status: next,
          version: r.version + 1,
          lastAction: "payment:refund",
          lastActionVersion: r.version,
        })
        .where(eq(s.requests.id, r.id));
      await event(
        tx,
        r,
        next,
        mode === "test"
          ? `Remboursement Stripe TEST confirmé : ${proof.amount} centimes. Aucun remboursement commercial.`
          : `Remboursement Stripe live confirmé : ${proof.amount} centimes. Motif : ${row.reason}.${next !== r.status ? " Réouverture financière auditée : facture non acquittée, sans nouvelle intervention." : ""}`,
        "system",
        null
      );
    }
    await recordAudit(
      tx,
      row.requestedBy,
      `payment.refund.${mode}.${status}`,
      "refund",
      row.id
    );
    return safeRefund({
      ...row,
      providerRefundId: proof.id,
      status,
      confirmedAt,
    });
  });
}
export const refundProcedures = {
  refundable: artisan.input(paymentInput).query(async ({ input }) => {
    const db = await dbRequired();
    const p = await loadPayment(db, input.paymentId);
    const { stripe, mode } = stripeRequired();
    const actual = await funds(stripe, mode, p);
    const rows = await db
      .select()
      .from(s.refunds)
      .where(eq(s.refunds.paymentId, p.id));
    const remaining = Math.max(
      0,
      Math.min(actual.providerRemaining, actual.received - occupied(rows))
    );
    return {
      paymentId: p.id,
      reference: p.reference,
      mode: p.mode,
      currency: "EUR" as const,
      receivedAmountCents: actual.received,
      reservedAmountCents: p.amountCents,
      remainingRefundableCents: remaining,
      hasPending: rows.some(r => r.status === "pending"),
      refunds: rows.map(safeRefund),
    };
  }),
  refundHistory: artisan
    .input(z.object({ requestId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await dbRequired();
      const payments = await db
        .select()
        .from(s.payments)
        .where(eq(s.payments.requestId, input.requestId));
      const rows = await Promise.all(
        payments.map(p =>
          db.select().from(s.refunds).where(eq(s.refunds.paymentId, p.id))
        )
      );
      return rows.flat().map(safeRefund);
    }),
  refund: artisan
    .input(
      paymentInput.extend({
        amountCents: z.number().int().positive(),
        mode: z.enum(["test", "live"]),
        reference: z.string().min(1).max(255),
        reason: z.string().trim().min(5).max(2000),
        confirm: z.literal(true),
        idempotencyKey: z.string().min(16).max(80),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      const p = await loadPayment(db, input.paymentId);
      const { stripe, mode } = stripeRequired();
      if (
        input.mode !== mode ||
        p.mode !== input.mode ||
        p.reference !== input.reference
      )
        fail(
          "Confirmez exactement le mode et la référence de ce versement.",
          "CONFLICT"
        );
      const key = `mds-refund-${hash(`${p.id}:${input.idempotencyKey}`)}`;
      const previous = (
        await db
          .select()
          .from(s.refunds)
          .where(eq(s.refunds.idempotencyKey, key))
      )[0];
      if (
        previous &&
        (previous.amountCents !== input.amountCents ||
          previous.reason !== input.reason ||
          previous.mode !== input.mode ||
          previous.requestedBy !== ctx.user.id)
      )
        fail(
          "Cette clé a déjà été utilisée pour une autre confirmation.",
          "CONFLICT"
        );
      if (previous?.providerRefundId)
        return applyRefund(
          db,
          previous,
          p,
          stripe,
          mode,
          previous.providerRefundId
        );
      const actual = await funds(stripe, mode, p);
      const reserved = await db.transaction(async tx => {
        await principal(tx, true);
        const current = await loadPayment(tx, p.id);
        if (
          current.paymentIntentId !== p.paymentIntentId ||
          current.mode !== mode ||
          current.reference !== input.reference
        )
          fail("Le paiement a changé.", "CONFLICT");
        const rows = await tx
          .select()
          .from(s.refunds)
          .where(eq(s.refunds.paymentId, p.id))
          .for("update");
        const old = rows.find(r => r.idempotencyKey === key);
        if (old) {
          if (
            old.amountCents !== input.amountCents ||
            old.reason !== input.reason ||
            old.requestedBy !== ctx.user.id ||
            old.mode !== mode
          )
            fail("Cette clé désigne une autre confirmation.", "CONFLICT");
          if (
            old.status !== "pending" ||
            old.createdAt.getTime() < Date.now() - 23 * 3600000
          )
            fail(
              "Cette réservation doit être rapprochée ; aucune nouvelle dépense.",
              "CONFLICT"
            );
          return old;
        }
        if (rows.some(r => r.status === "pending"))
          fail(
            "Un remboursement est déjà en attente. Relisez-le avant toute nouvelle opération.",
            "CONFLICT"
          );
        const cap = Math.min(
          actual.providerRemaining,
          actual.received - occupied(rows)
        );
        if (input.amountCents > cap)
          fail(
            "Le montant dépasse les fonds réellement reçus encore remboursables.",
            "CONFLICT"
          );
        const [created] = await tx
          .insert(s.refunds)
          .values({
            paymentId: p.id,
            amountCents: input.amountCents,
            currency: "EUR",
            mode,
            status: "pending",
            idempotencyKey: key,
            reason: input.reason,
            requestedBy: ctx.user.id,
          })
          .$returningId();
        await tx
          .update(s.payments)
          .set({ receivedAmountCents: actual.received })
          .where(eq(s.payments.id, p.id));
        await recordAudit(
          tx,
          ctx.user.id,
          `payment.refund.${mode}.reserved`,
          "refund",
          created.id
        );
        const [row] = await tx
          .select()
          .from(s.refunds)
          .where(eq(s.refunds.id, created.id));
        return row;
      });
      if (reserved.providerRefundId)
        return applyRefund(
          db,
          reserved,
          p,
          stripe,
          mode,
          reserved.providerRefundId
        );
      let result: Stripe.Refund;
      try {
        result = await stripe.refunds.create(
          {
            payment_intent: p.paymentIntentId!,
            amount: reserved.amountCents,
            metadata: {
              mds_refund_id: String(reserved.id),
              mds_payment_id: String(p.id),
            },
          },
          { idempotencyKey: reserved.idempotencyKey }
        );
      } catch {
        fail(
          "Stripe n’a pas confirmé la création. La réservation et sa clé sont conservées ; reprenez cette même confirmation, sans nouvel ordre.",
          "CONFLICT"
        );
      }
      if (!result.id?.startsWith("re_"))
        fail("La réponse Stripe nécessite un rapprochement.", "CONFLICT");
      // Persist the provider ID even if its proof cannot yet be fetched. Never infer succeeded from create().
      await db.transaction(async tx => {
        await principal(tx, true);
        const [row] = await tx
          .select()
          .from(s.refunds)
          .where(eq(s.refunds.id, reserved.id))
          .for("update");
        if (row.providerRefundId && row.providerRefundId !== result.id)
          fail("La référence Stripe diverge.", "CONFLICT");
        await tx
          .update(s.refunds)
          .set({ providerRefundId: result.id })
          .where(eq(s.refunds.id, row.id));
      });
      return applyRefund(db, reserved, p, stripe, mode, result.id);
    }),
  syncRefund: artisan
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await dbRequired();
      const [row] = await db
        .select()
        .from(s.refunds)
        .where(eq(s.refunds.id, input.id));
      if (!row) fail("Ce remboursement est introuvable.", "NOT_FOUND");
      if (!row.providerRefundId)
        fail(
          "La création est ambiguë. Reprenez exactement la confirmation originale et sa clé avant 23 h ; sinon rapprochement Dashboard requis.",
          "CONFLICT"
        );
      const p = await loadPayment(db, row.paymentId);
      const { stripe, mode } = stripeRequired();
      if (row.mode !== mode || p.mode !== mode)
        fail(
          "Les clés actives ne correspondent pas à ce remboursement.",
          "CONFLICT"
        );
      return applyRefund(db, row, p, stripe, mode, row.providerRefundId);
    }),
};
