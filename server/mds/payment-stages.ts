import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "../../drizzle/schema";
import { trackSchema } from "../../shared/mds";
import { MAX_CENTS } from "../../shared/pricing";
import {
  artisan,
  authorizeRequest,
  dbRequired,
  event,
  principal,
  procedure,
  recordAudit,
  type SqlDb,
} from "./common";
import { fail } from "./workflow";

export type Purpose = "full" | "deposit" | "balance";
export async function commercialPaidCents(
  tx: SqlDb,
  requestId: number
): Promise<number> {
  const payments = await tx
    .select()
    .from(s.payments)
    .where(eq(s.payments.requestId, requestId));
  let total = 0;
  for (const p of payments) {
    // No backfill from the reserved amount or a historical paid invoice: only explicit money evidence counts.
    if (
      p.status !== "succeeded" ||
      !p.creditedAt ||
      !p.confirmedAt ||
      p.currency !== "EUR" ||
      !["live", "offline"].includes(p.mode) ||
      p.receivedAmountCents == null ||
      !Number.isSafeInteger(p.receivedAmountCents) ||
      p.receivedAmountCents < 0
    )
      continue;
    const refunded =
      p.mode === "live"
        ? (
            await tx
              .select()
              .from(s.refunds)
              .where(eq(s.refunds.paymentId, p.id))
          )
            .filter(
              r =>
                r.status === "succeeded" &&
                r.confirmedAt &&
                r.mode === "live" &&
                r.currency === "EUR"
            )
            .reduce((n, r) => n + r.amountCents, 0)
        : 0;
    total += Math.max(0, p.receivedAmountCents - refunded);
  }
  if (!Number.isSafeInteger(total))
    fail("Le registre doit être rapproché par MDS.", "CONFLICT");
  return total;
}
export async function currentPlan(db: SqlDb, requestId: number) {
  const rows = await db
    .select()
    .from(s.paymentPlans)
    .where(eq(s.paymentPlans.requestId, requestId))
    .orderBy(desc(s.paymentPlans.id));
  return (
    rows
      .sort((a, b) => b.id - a.id)
      .find(p => ["accepted", "proposed"].includes(p.status)) || null
  );
}
const contractStates = [
  "accepted_mds",
  "awaiting_client",
  "confirmed",
  "planned",
  "en_route",
  "in_progress",
  "completed",
  "invoiced",
  "paid",
  "closed",
];
export async function contractTotalCents(
  db: SqlDb,
  r: s.MdsRequest
): Promise<number> {
  if (
    !contractStates.includes(r.status) ||
    (r.expiresAt &&
      r.expiresAt.getTime() <= Date.now() &&
      ["accepted_mds", "awaiting_client"].includes(r.status))
  )
    fail(
      "Un accord MDS et un prix contractuel valides sont nécessaires.",
      "CONFLICT"
    );
  let base: number | null = null;
  if (r.quoteStatus === "accepted") {
    const quotes = await db
      .select()
      .from(s.quotes)
      .where(
        and(eq(s.quotes.requestId, r.id), eq(s.quotes.status, "accepted"))
      );
    const q = quotes.sort((a, b) => b.id - a.id)[0];
    if (q?.acceptedAt) base = q.amountCents ?? r.proposedPriceCents;
    if (base !== r.proposedPriceCents)
      fail("Le devis accepté et le dossier divergent.", "CONFLICT");
  } else if (
    r.quoteStatus === "none" &&
    r.pricingSnapshot?.pricingMode === "fixed" &&
    r.proposedPriceCents === r.pricingSnapshot.totalCents
  )
    base = r.proposedPriceCents;
  if (base == null || !Number.isSafeInteger(base) || base < 0)
    fail(
      "Aucun prix fixe validé ou devis accepté ne permet cet échéancier.",
      "CONFLICT"
    );
  const extras = await db
    .select()
    .from(s.extraWorks)
    .where(eq(s.extraWorks.requestId, r.id));
  const total =
    base +
    extras
      .filter(e => e.status === "completed" && e.acceptedAt && e.completedAt)
      .reduce((n, e) => n + e.amountCents, 0);
  if (!Number.isSafeInteger(total) || total > MAX_CENTS)
    fail("Le total contractuel est invalide.", "CONFLICT");
  return total;
}
export async function stageFor(
  db: SqlDb,
  r: s.MdsRequest,
  invoice: typeof s.invoices.$inferSelect | undefined,
  purpose: Purpose
) {
  const paid = await commercialPaidCents(db, r.id);
  const plan = await currentPlan(db, r.id);
  if (purpose === "deposit") {
    const total = await contractTotalCents(db, r);
    if (
      !plan ||
      plan.status !== "accepted" ||
      plan.totalCents !== total ||
      plan.depositCents < 50 ||
      plan.depositCents > total ||
      ["paid", "closed"].includes(r.status)
    )
      fail(
        "L’acompte exige l’échéancier actuel accepté et un contrat inchangé.",
        "CONFLICT"
      );
    const amountCents = Math.min(plan.depositCents, Math.max(0, total - paid));
    if (paid > 0 || amountCents !== plan.depositCents)
      fail(
        "Un acompte a déjà été imputé. Utilisez le solde après facturation.",
        "CONFLICT"
      );
    return {
      amountCents,
      invoiceId: invoice?.id ?? null,
      planId: plan.id,
      purpose,
    };
  }
  if (!invoice) fail("Aucune facture émise ne permet ce paiement.", "CONFLICT");
  if (invoice.paidAt || ["paid", "closed"].includes(r.status))
    fail(
      "Cette facture est déjà réglée. Aucun nouveau paiement n’est nécessaire.",
      "CONFLICT"
    );
  if (r.status !== "invoiced")
    fail(
      "Le dossier doit avoir une facture émise avant le paiement.",
      "CONFLICT"
    );
  if (
    invoice.amountCents == null ||
    !Number.isSafeInteger(invoice.amountCents) ||
    invoice.amountCents < 50
  )
    fail(
      "La facture doit comporter un montant validé d’au moins 0,50 € pour Stripe.",
      "CONFLICT"
    );
  if (invoice.currency !== "EUR")
    fail("Seules les factures en euros sont prises en charge.", "CONFLICT");
  // New contractual dossiers must match their immutable accepted base and completed accepted extras.
  // Historical issued invoices retain their original linked-full pathway; no money fields are invented.
  if (r.pricingSnapshot || r.quoteStatus === "accepted") {
    if (invoice.amountCents !== (await contractTotalCents(db, r)))
      fail(
        "La facture ne correspond pas au contrat accepté et aux suppléments terminés.",
        "CONFLICT"
      );
  } else if (r.quoteStatus && r.quoteStatus !== "none")
    fail("Le devis actuel n’est pas accepté.", "CONFLICT");
  const amountCents = Math.max(0, invoice.amountCents - paid);
  if (amountCents < 50)
    fail(
      "Le restant dû ne permet pas un paiement Stripe d’au moins 0,50 €.",
      "CONFLICT"
    );
  return {
    amountCents,
    invoiceId: invoice.id,
    planId: plan?.status === "accepted" ? plan.id : null,
    purpose,
  };
}
export const stageProcedures = {
  plan: procedure.input(trackSchema).query(async ({ input, ctx }) => {
    const db = await dbRequired();
    const [r] = await db
      .select()
      .from(s.requests)
      .where(eq(s.requests.reference, input.reference));
    if (!r) fail("Cette demande est introuvable.", "NOT_FOUND");
    await authorizeRequest(db, r, ctx.user, input.token);
    const activePlan = await currentPlan(db, r.id);
    const [invoice] = await db
      .select()
      .from(s.invoices)
      .where(eq(s.invoices.requestId, r.id));
    const rows = await db
      .select()
      .from(s.payments)
      .where(eq(s.payments.requestId, r.id));
    const totalPaidCents = await commercialPaidCents(db, r.id);
    const totalCents = invoice?.amountCents ?? activePlan?.totalCents ?? null;
    const withheldLive = rows.some(
      p => p.mode === "live" && p.status === "succeeded" && !p.creditedAt
    );
    const pendingLive = rows.some(
      p =>
        p.provider === "stripe" &&
        p.mode === "live" &&
        ["pending", "failed"].includes(p.status)
    );
    const successfulTestPurposes = rows
      .filter(p => p.mode === "test" && p.status === "succeeded")
      .map(p => p.purpose);
    let depositCents: number | null = null;
    try {
      depositCents = (await stageFor(db, r, invoice, "deposit")).amountCents;
    } catch {
      /* unavailable stage */
    }
    const remainingCents =
      totalCents == null ? null : Math.max(0, totalCents - totalPaidCents);
    let invoicePayable = false;
    try {
      await stageFor(db, r, invoice, totalPaidCents > 0 ? "balance" : "full");
      invoicePayable = true;
    } catch {
      /* no payable final stage */
    }
    const refundRows = (
      await Promise.all(
        rows.map(p =>
          db.select().from(s.refunds).where(eq(s.refunds.paymentId, p.id))
        )
      )
    ).flat();
    const publicRefunds = refundRows.map(r => ({
      id: r.id,
      paymentId: r.paymentId,
      amountCents: r.amountCents,
      currency: r.currency,
      mode: r.mode,
      status: r.status,
      confirmedAt: r.confirmedAt,
      createdAt: r.createdAt,
    }));
    return {
      activePlan,
      totalCents,
      totalPaidCents,
      remainingCents,
      depositCents,
      invoice: invoice
        ? {
            id: invoice.id,
            amountCents: invoice.amountCents,
            currency: invoice.currency,
            paidAt: invoice.paidAt,
          }
        : null,
      withheldLive,
      pendingLive,
      successfulTestPurposes,
      invoicePayable,
      refunds: publicRefunds,
      testReceivedCents: rows
        .filter(
          p =>
            p.mode === "test" &&
            p.status === "succeeded" &&
            p.currency === "EUR"
        )
        .reduce((n, p) => n + (p.receivedAmountCents ?? 0), 0),
    };
  }),
  proposePlan: artisan
    .input(
      z.object({
        requestId: z.number().int().positive(),
        version: z.number().int().min(0),
        depositCents: z.number().int().min(50).max(MAX_CENTS),
        conditions: z.string().trim().min(5).max(3000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        const [r] = await tx
          .select()
          .from(s.requests)
          .where(eq(s.requests.id, input.requestId))
          .for("update");
        if (!r) fail("Cette demande est introuvable.", "NOT_FOUND");
        if (r.version !== input.version)
          fail("Le dossier a changé. Actualisez.", "CONFLICT");
        if (["paid", "closed"].includes(r.status))
          fail(
            "Ce dossier est déjà réglé ; aucun nouvel échéancier.",
            "CONFLICT"
          );
        const totalCents = await contractTotalCents(tx, r);
        if (input.depositCents > totalCents)
          fail("L’acompte dépasse le contrat.", "CONFLICT");
        const money = await tx
          .select()
          .from(s.payments)
          .where(eq(s.payments.requestId, r.id));
        if (
          money.some(
            p =>
              p.mode !== "test" && !["expired", "cancelled"].includes(p.status)
          )
        )
          fail(
            "Un versement ou une réservation existe. Rapprochez les fonds avant de modifier l’échéancier.",
            "CONFLICT"
          );
        const old = await currentPlan(tx, r.id);
        if (old)
          await tx
            .update(s.paymentPlans)
            .set({ status: "cancelled", version: old.version + 1 })
            .where(eq(s.paymentPlans.id, old.id));
        const [created] = await tx
          .insert(s.paymentPlans)
          .values({
            requestId: r.id,
            totalCents,
            depositCents: input.depositCents,
            conditions: input.conditions,
            status: "proposed",
            version: 0,
          })
          .returning({ id: s.paymentPlans.id });
        await tx
          .update(s.requests)
          .set({
            version: r.version + 1,
            lastAction: "payment:plan",
            lastActionVersion: r.version,
          })
          .where(eq(s.requests.id, r.id));
        await event(
          tx,
          r,
          r.status,
          `Échéancier proposé : total ${totalCents} centimes, acompte ${input.depositCents} centimes. Conditions : ${input.conditions}. Accord de paiement distinct du rendez-vous.`,
          "artisan",
          ctx.user.id
        );
        await recordAudit(
          tx,
          ctx.user.id,
          "payment.plan.proposed",
          "payment_plan",
          created.id
        );
        return { id: created.id };
      });
    }),
  respondPlan: procedure
    .input(
      trackSchema.extend({
        id: z.number().int().positive(),
        version: z.number().int().min(0),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        const p = await principal(tx, true);
        if (ctx.user?.id === p.artisanUserId)
          fail("L’accord appartient au client, pas à l’artisan.", "FORBIDDEN");
        const [r] = await tx
          .select()
          .from(s.requests)
          .where(eq(s.requests.reference, input.reference))
          .for("update");
        if (!r) fail("Cette demande est introuvable.", "NOT_FOUND");
        await authorizeRequest(tx, r, ctx.user, input.token);
        const plan = await currentPlan(tx, r.id);
        if (
          !plan ||
          plan.id !== input.id ||
          plan.version !== input.version ||
          plan.status !== "proposed"
        )
          fail(
            "Cet échéancier n’est plus la proposition actuelle.",
            "CONFLICT"
          );
        if (plan.totalCents !== (await contractTotalCents(tx, r)))
          fail(
            "Le contrat a changé. Un nouvel échéancier est nécessaire.",
            "CONFLICT"
          );
        await tx
          .update(s.paymentPlans)
          .set({
            status: input.accept ? "accepted" : "refused",
            acceptedAt: input.accept ? new Date() : null,
            version: plan.version + 1,
          })
          .where(eq(s.paymentPlans.id, plan.id));
        await event(
          tx,
          r,
          r.status,
          `Le client a ${input.accept ? "accepté" : "refusé"} l’échéancier ${plan.id}, version ${plan.version} : total ${plan.totalCents} centimes, acompte ${plan.depositCents} centimes. Conditions : ${plan.conditions}. Ce consentement ne confirme pas le rendez-vous.`,
          "client",
          ctx.user?.id ?? null
        );
        await recordAudit(
          tx,
          ctx.user?.id ?? null,
          input.accept ? "payment.plan.accepted" : "payment.plan.refused",
          "payment_plan",
          plan.id
        );
        return { accepted: input.accept };
      });
    }),
};

export const settlementProcedures = {
  settlements: artisan.query(async ({ ctx }) => {
    const db = await dbRequired();
    const rows = await db
      .select({
        payment: s.payments,
        request: s.requests,
      })
      .from(s.payments)
      .innerJoin(s.requests, eq(s.requests.id, s.payments.requestId))
      .orderBy(desc(s.payments.createdAt), desc(s.payments.id));
    const result = [];
    for (const row of rows) {
      if (row.payment.status !== "succeeded") continue;
      const [intervention] = await db
        .select({
          completedAt: s.interventions.completedAt,
          clientConfirmedAt: s.interventions.clientConfirmedAt,
        })
        .from(s.interventions)
        .where(eq(s.interventions.requestId, row.request.id));
      const [openIncident] = await db
        .select({ id: s.incidents.id })
        .from(s.incidents)
        .where(
          and(
            eq(s.incidents.requestId, row.request.id),
            eq(s.incidents.status, "open")
          )
        )
        .limit(1);
      const status = openIncident
        ? "blocked"
        : !intervention?.clientConfirmedAt
          ? "pending_validation"
          : "pending_transfer";
      result.push({
        id: row.payment.id,
        reference: row.request.reference,
        serviceName: row.request.serviceName,
        amountCents: row.payment.receivedAmountCents ?? row.payment.amountCents,
        currency: row.payment.currency,
        mode: row.payment.mode,
        paidAt: row.payment.confirmedAt ?? row.payment.createdAt,
        interventionCompletedAt: intervention?.completedAt ?? null,
        clientConfirmedAt: intervention?.clientConfirmedAt ?? null,
        status,
        transferEnabled: false as const,
      });
    }
    return result;
  }),
};
