import express, { type Express, type Request, type Response } from "express";
import { and, eq, ne, or } from "drizzle-orm";
import type Stripe from "stripe";
import * as s from "../../drizzle/schema";
import {
  dbRequired,
  event as businessEvent,
  principal,
  recordAudit,
  type Tx,
} from "./common";
import { providerId, stripeRequired, type Payment } from "./payments";
import { stageFor } from "./payment-stages";

type Metadata = Record<string, string> | null;
type Evidence = {
  metadata: Metadata;
  amount: number | null;
  currency: string | null;
  successful: boolean;
  sessionId: string | null;
  intentId: string | null;
  reference: string | null;
  validObject: boolean;
  failureReason: string | null;
};
function positiveId(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}
function evidence(event: Stripe.Event): Evidence | null {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      metadata: session.metadata,
      amount: session.amount_total,
      currency: session.currency,
      successful: session.payment_status === "paid",
      sessionId: session.id,
      intentId: providerId(session.payment_intent),
      reference: session.client_reference_id,
      validObject:
        session.object === "checkout.session" &&
        session.id.startsWith("cs_") &&
        session.mode === "payment" &&
        session.livemode === event.livemode,
      failureReason:
        session.payment_status !== "paid" ? "Session non complétée" : null,
    };
  }
  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const intent = event.data.object as Stripe.PaymentIntent;
    const successful = event.type === "payment_intent.succeeded";
    return {
      metadata: intent.metadata,
      amount: successful ? intent.amount_received : intent.amount,
      currency: intent.currency,
      successful,
      sessionId: null,
      intentId: intent.id,
      reference: null,
      validObject:
        intent.object === "payment_intent" &&
        intent.id.startsWith("pi_") &&
        intent.livemode === event.livemode &&
        (!successful || intent.status === "succeeded"),
      failureReason: !successful
        ? intent.last_payment_error?.message ||
          intent.last_payment_error?.code ||
          intent.cancellation_reason ||
          "Paiement refusé par la banque"
        : null,
    };
  }
  return null;
}
async function notifyReview(
  tx: Tx,
  request: s.MdsRequest,
  payment: Payment,
  reason: string
) {
  const p = await principal(tx);
  await tx.insert(s.notifications).values({
    userId: p.artisanUserId,
    requestId: request.id,
    audience: "artisan",
    title: `${request.reference} — paiement à rapprocher`,
    message: `Stripe live signale un règlement pour ${payment.reference || `paiement ${payment.id}`}, sans validation de la facture : ${reason}. Vérifiez le Dashboard Stripe et effectuez un rapprochement manuel avant toute clôture ou nouveau débit.`,
  });
  await recordAudit(tx, null, "payment.live.review", "payment", payment.id);
}
async function reject(
  tx: Tx,
  request: s.MdsRequest | undefined,
  payment: Payment,
  ev: Stripe.Event,
  reason: string,
  received: boolean
) {
  if (received && ev.livemode && request)
    await notifyReview(tx, request, payment, reason);
  await recordAudit(
    tx,
    null,
    `payment.webhook.reject.${reason}`,
    "payment",
    payment.id
  );
  return reason;
}

/** Called only with an event verified against the exact raw bytes. No payload/card mirror is retained. */
export async function processPaymentEvent(
  ev: Stripe.Event,
  configuredMode: "test" | "live"
) {
  const db = await dbRequired();
  return db.transaction(async tx => {
    // Shared lock serializes checkout, manual verification, fulfillment and event-id dedup across processes.
    await principal(tx, true);
    const [seen] = await tx
      .select()
      .from(s.paymentEvents)
      .where(eq(s.paymentEvents.eventId, ev.id));
    if (seen) return { duplicate: true, outcome: seen.outcome };
    const mode = ev.livemode ? ("live" as const) : ("test" as const);
    const proof = evidence(ev);
    const paymentId = positiveId(proof?.metadata?.payment_id);
    const [payment] = paymentId
      ? await tx
          .select()
          .from(s.payments)
          .where(eq(s.payments.id, paymentId))
          .for("update")
      : [];
    let outcome = "ignored_unrelated";
    if (mode !== configuredMode) outcome = "rejected_mode";
    else if (!proof)
      outcome = ev.type.startsWith("customer.subscription.")
        ? "ignored_subscription"
        : "ignored_unrelated";
    else if (payment) outcome = await applyEvidence(tx, ev, proof, payment);
    await tx.insert(s.paymentEvents).values({
      eventId: ev.id,
      provider: "stripe",
      mode,
      type: ev.type,
      paymentId: payment?.id || null,
      outcome,
    });
    return { duplicate: false, outcome };
  });
}
async function applyEvidence(
  tx: Tx,
  ev: Stripe.Event,
  proof: Evidence,
  payment: Payment
) {
  const [request] = await tx
    .select()
    .from(s.requests)
    .where(eq(s.requests.id, payment.requestId))
    .for("update");
  const [invoice] = await tx
    .select()
    .from(s.invoices)
    .where(eq(s.invoices.requestId, payment.requestId))
    .for("update");
  const md = proof.metadata;
  const rejectEvidence = (reason: string) =>
    reject(tx, request, payment, ev, reason, proof.successful);
  if (
    payment.provider !== "stripe" ||
    payment.mode !== (ev.livemode ? "live" : "test")
  )
    return rejectEvidence("rejected_payment_mode");
  if (
    !proof.validObject ||
    !md ||
    positiveId(md.payment_id) !== payment.id ||
    positiveId(md.request_id) !== payment.requestId ||
    (payment.invoiceId == null
      ? md.invoice_id !== ""
      : positiveId(md.invoice_id) !== payment.invoiceId) ||
    (md.purpose ?? "full") !== (payment.purpose || "full") ||
    (md.plan_id ?? "") !==
      (payment.planId == null ? "" : String(payment.planId)) ||
    !payment.checkoutKey ||
    md.checkout_key !== payment.checkoutKey
  )
    return rejectEvidence("rejected_linkage");
  if (
    !request ||
    ((payment.purpose || "full") !== "deposit" &&
      (!invoice || invoice.id !== payment.invoiceId)) ||
    (invoice && invoice.requestId !== request.id) ||
    payment.requestId !== request.id
  )
    return rejectEvidence("rejected_business_linkage");
  if (proof.sessionId && proof.reference !== request.reference)
    return rejectEvidence("rejected_reference");
  if (
    (proof.sessionId &&
      payment.checkoutSessionId &&
      proof.sessionId !== payment.checkoutSessionId) ||
    (proof.intentId &&
      payment.paymentIntentId &&
      proof.intentId !== payment.paymentIntentId) ||
    (proof.intentId && !proof.intentId.startsWith("pi_"))
  )
    return rejectEvidence("rejected_provider_id");
  const idConditions = [
    proof.sessionId
      ? eq(s.payments.checkoutSessionId, proof.sessionId)
      : undefined,
    proof.intentId ? eq(s.payments.paymentIntentId, proof.intentId) : undefined,
  ].filter(Boolean);
  if (idConditions.length) {
    const [other] = await tx
      .select()
      .from(s.payments)
      .where(and(ne(s.payments.id, payment.id), or(...idConditions)))
      .limit(1);
    if (other) return rejectEvidence("rejected_provider_id_reused");
  }
  const ids: Partial<typeof s.payments.$inferInsert> = {
    ...(proof.sessionId ? { checkoutSessionId: proof.sessionId } : {}),
    ...(proof.intentId ? { paymentIntentId: proof.intentId } : {}),
  };
  // Subscription events do not reach this branch; an unpaid completion never fulfills.
  if (ev.type === "checkout.session.completed" && !proof.successful) {
    await tx.update(s.payments).set(ids).where(eq(s.payments.id, payment.id));
    return "awaiting_payment";
  }
  // A second success/late failure can add a missing identifier, never undo or re-emit fulfillment.
  if (payment.status === "succeeded") {
    if (
      proof.successful &&
      (proof.amount !== (payment.receivedAmountCents ?? payment.amountCents) ||
        proof.currency?.toLowerCase() !== "eur")
    )
      return rejectEvidence("rejected_succeeded_amount");
    await tx.update(s.payments).set(ids).where(eq(s.payments.id, payment.id));
    return proof.successful ? "already_succeeded" : "ignored_late_failure";
  }
  if (!proof.successful) {
    if (
      proof.currency?.toLowerCase() !== "eur" ||
      proof.amount !== payment.amountCents
    )
      return rejectEvidence("rejected_failed_amount");
    await tx
      .update(s.payments)
      .set({
        ...ids,
        status: "failed",
        failureReason: proof.failureReason || "Paiement refusé",
      })
      .where(eq(s.payments.id, payment.id));
    await recordAudit(
      tx,
      null,
      `payment.failed.${payment.mode}`,
      "payment",
      payment.id
    );
    return "failed";
  }
  const amountMatches =
    Number.isSafeInteger(proof.amount) &&
    proof.amount === payment.amountCents &&
    payment.amountCents >= 50 &&
    proof.currency?.toLowerCase() === "eur" &&
    payment.currency === "EUR";
  let stageMatches = false;
  let stateMatches = request.status === "invoiced" && !invoice?.paidAt;
  if (payment.purpose === "deposit")
    stateMatches = ![
      "paid",
      "closed",
      "cancelled",
      "refused",
      "expired",
      "quote_refused",
    ].includes(request.status);
  try {
    const stage = await stageFor(
      tx,
      request,
      invoice,
      payment.purpose || "full"
    );
    stageMatches =
      stage.amountCents === payment.amountCents &&
      stage.planId == payment.planId &&
      (stage.invoiceId === payment.invoiceId ||
        (payment.purpose === "deposit" && payment.invoiceId == null));
  } catch {
    /* preserve provider receipt, withhold commercial credit */
  }
  const reason = !amountMatches
    ? "withheld_amount_currency"
    : !stateMatches
      ? "withheld_request_state"
      : !stageMatches
        ? "withheld_invoice_changed"
        : null;
  // succeeded describes the signed provider ledger, not commercial fulfillment. Discount mismatches are withheld.
  const confirmedAt = new Date();
  await tx
    .update(s.payments)
    .set({
      ...ids,
      status: "succeeded",
      confirmedAt,
      receivedAmountCents:
        proof.currency?.toLowerCase() === "eur" &&
        Number.isSafeInteger(proof.amount) &&
        proof.amount! >= 0
          ? proof.amount
          : null,
      creditedAt: !reason && payment.mode === "live" ? confirmedAt : null,
      verificationNote: reason
        ? `Stripe ${payment.mode} : ${reason}; facture non acquittée, rapprochement nécessaire.`
        : payment.mode === "test"
          ? "Paiement Stripe test validé, sans encaissement réel ni acquittement de facture."
          : "Paiement Stripe live signé, montant et devise conformes à la facture.",
    })
    .where(eq(s.payments.id, payment.id));
  if (reason) {
    if (ev.livemode) await notifyReview(tx, request, payment, reason);
    await recordAudit(
      tx,
      null,
      `payment.${payment.mode}.${reason}`,
      "payment",
      payment.id
    );
    return reason;
  }
  if (payment.mode === "test") {
    await recordAudit(
      tx,
      null,
      "payment.test.succeeded_no_fulfillment",
      "payment",
      payment.id
    );
    return "test_succeeded_no_fulfillment";
  }
  if (payment.purpose === "deposit") {
    await businessEvent(
      tx,
      request,
      request.status,
      `Acompte réellement reçu et imputé : ${payment.amountCents} centimes. Le paiement ne confirme ni le rendez-vous ni l’acquittement final.`,
      "system",
      null
    );
    await recordAudit(
      tx,
      null,
      "payment.live.deposit_received",
      "payment",
      payment.id
    );
    return "live_deposit_received";
  }
  if (!invoice) throw new Error("Missing fulfillment invoice");
  const [changed] = await tx
    .update(s.requests)
    .set({
      status: "paid",
      version: request.version + 1,
      lastAction: "stripe:paid",
      lastActionVersion: request.version,
    })
    .where(
      and(
        eq(s.requests.id, request.id),
        eq(s.requests.version, request.version),
        eq(s.requests.status, "invoiced")
      )
    );
  if (changed.affectedRows !== 1)
    throw new Error("Concurrent payment fulfillment change");
  await tx
    .update(s.invoices)
    .set({
      paidAt: confirmedAt,
      paymentVerifiedBy: null,
      verificationNote: `Paiement Stripe live signé — ${payment.reference || payment.id}.`,
    })
    .where(eq(s.invoices.id, invoice.id));
  const amount = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(payment.amountCents / 100);
  await businessEvent(
    tx,
    request,
    "paid",
    `Votre facture MDS de ${amount} est réglée. Stripe a confirmé le paiement réel en euros. La facture et le suivi restent disponibles depuis votre lien privé.`,
    "system",
    null,
    "Facture réglée"
  );
  await recordAudit(tx, null, "payment.live.fulfilled", "payment", payment.id);
  return "live_fulfilled";
}

export async function paymentWebhookHandler(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
    res
      .status(400)
      .json({ received: false, error: "Signature ou corps brut manquant" });
    return;
  }
  let stripe: Stripe;
  let mode: "test" | "live";
  try {
    ({ stripe, mode } = stripeRequired());
  } catch {
    res.status(503).json({ received: false, error: "Paiement indisponible" });
    return;
  }
  let ev: Stripe.Event;
  try {
    ev = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    res.status(400).json({ received: false, error: "Signature invalide" });
    return;
  }
  try {
    const result = await processPaymentEvent(ev, mode);
    res.status(200).json({ received: true, ...result });
  } catch {
    // No raw event, error payload, customer or credential in logs/responses. Stripe must retry a failed transaction.
    console.error(
      "[MDS payment] Transaction webhook impossible ; nouvelle livraison requise."
    );
    res.status(500).json({
      received: false,
      error: "Traitement temporairement indisponible",
    });
  }
}
/** MUST be registered before express.json()/urlencoded() or any parser consuming this path. */
export function registerPaymentWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json", limit: "256kb" }),
    paymentWebhookHandler
  );
}
