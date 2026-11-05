import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import { createRequestSchema, artisanActionSchema, clientActionSchema, trackSchema, type RequestStatus } from "../../shared/mds";
import * as s from "../../drizzle/schema";
import { authenticated, artisan, authorizeRequest, dbRequired, detailData, event, hash, membership, principal, procedure, publicRequest, recordAudit, requestFilter, secretHash, secureEqual, type Identity, type Tx } from "./common";
import { analysisStates, checkVersion, fail, isExpired, mayConfirm, negotiableStates, requireMessage, requireState, safeAnswers, slot } from "./workflow";
import { requireContractPrice, resolvePricing } from "./tariffs";

async function expire(tx: Tx, request: s.MdsRequest) {
  if (!isExpired(request)) return false;
  await tx.update(s.requests).set({ status: "expired", version: request.version + 1, expiresAt: null, lastAction: "expire", lastActionVersion: request.version }).where(and(eq(s.requests.id, request.id), eq(s.requests.version, request.version)));
  if (request.quoteStatus === "pending") await tx.update(s.quotes).set({ status: "superseded" }).where(and(eq(s.quotes.requestId, request.id), eq(s.quotes.status, "pending")));
  await event(tx, request, "expired", "Le délai de confirmation de la proposition est dépassé. Un nouvel accord MDS est nécessaire.", "system", null);
  await recordAudit(tx, null, "request.expire", "request", request.id);
  request.status = "expired"; request.version++; request.expiresAt = null;
  return true;
}
export async function listScoped(user: s.User) {
  const db = await dbRequired();
  return db.transaction(async tx => {
    await principal(tx, true);
    const rows = await tx.select().from(s.requests).where(await requestFilter(tx, user)).orderBy(s.requests.createdAt).for("update");
    for (const row of rows) await expire(tx, row);
    return rows.reverse().map(publicRequest);
  });
}
async function load(tx: Tx, key: { id: number } | { reference: string }) {
  const [r] = await tx.select().from(s.requests).where("id" in key ? eq(s.requests.id, key.id) : eq(s.requests.reference, key.reference)).for("update");
  if (!r) fail("Cette demande est introuvable.", "NOT_FOUND");
  return r;
}
async function readDetail(key: { id: number } | { reference: string }, user: Identity, token?: string) {
  const db = await dbRequired();
  return db.transaction(async tx => {
    await principal(tx, true);
    const r = await load(tx, key);
    await authorizeRequest(tx, r, user, token);
    await expire(tx, r);
    let privateReviews = false;
    if (user) { try { await authorizeRequest(tx, r, user); privateReviews = true; } catch { /* A tracking token does not grant private review access. */ } }
    return detailData(tx, r, privateReviews);
  });
}
async function update(tx: Tx, r: s.MdsRequest, patch: Partial<typeof s.requests.$inferInsert>, action: string) {
  const [result] = await tx.update(s.requests).set({ ...patch, version: r.version + 1, lastAction: action, lastActionVersion: r.version }).where(and(eq(s.requests.id, r.id), eq(s.requests.version, r.version)));
  if (result.affectedRows !== 1) fail("Le dossier a changé. Actualisez-le avant de continuer.", "CONFLICT");
}
async function checkPlanning(tx: Tx, times: { startAt: Date; endAt: Date }) {
  const busy = await tx.select({ id: s.appointments.id }).from(s.appointments).where(and(ne(s.appointments.status, "cancelled"), lt(s.appointments.startAt, times.endAt), gt(s.appointments.endAt, times.startAt))).limit(1);
  const blocked = await tx.select({ id: s.availability.id }).from(s.availability).where(and(eq(s.availability.kind, "blocked"), lt(s.availability.startAt, times.endAt), gt(s.availability.endAt, times.startAt))).limit(1);
  if (busy.length || blocked.length) fail("Ce créneau entre en conflit avec le planning MDS. Demandez une nouvelle proposition.", "CONFLICT");
}

export const requestsRouter = router({
  create: procedure.input(createRequestSchema).mutation(async ({ input, ctx }) => {
    safeAnswers(input.answers);
    if (input.siteId && !input.organizationId) fail("Le site doit appartenir à une organisation autorisée.");
    const db = await dbRequired();
    const identity = ctx.user && ctx.user.id > 0 ? ctx.user : null;
    const idem = hash(`create:${input.idempotencyKey}`);
    const payload = hash(JSON.stringify({ ...input, answers: Object.fromEntries(Object.entries(input.answers).sort(([a], [b]) => a.localeCompare(b))), userId: identity?.id || null }));
    return db.transaction(async tx => {
      const p = await principal(tx, true); // Serializes idempotent creates and single-artisan calendar/claim writes.
      if (input.organizationId) {
        await membership(tx, input.organizationId, identity);
        if (input.siteId) {
          const [site] = await tx.select().from(s.sites).where(and(eq(s.sites.id, input.siteId), eq(s.sites.organizationId, input.organizationId)));
          if (!site) fail("Ce site n’appartient pas à cette organisation.", "FORBIDDEN");
        }
      }
      const [existing] = await tx.select().from(s.requests).where(eq(s.requests.idempotencyHash, idem));
      if (existing) {
        if (existing.payloadHash !== payload) fail("Cette clé de dépôt a déjà été utilisée pour une autre demande.", "CONFLICT");
        return { id: existing.id, reference: existing.reference, trackingToken: secretHash(`tracking:${existing.reference}:${idem}`, p.trackingSecret) };
      }
      if (input.desiredStart && new Date(input.desiredStart) <= new Date()) fail("Le créneau souhaité doit être futur.");
      const { service, snapshot, fingerprint } = await resolvePricing(tx, input.serviceId, input.postcode);
      if (service && input.pricingFingerprint !== fingerprint) fail("Les règles tarifaires ont changé ou n’ont pas été relues. Relisez le prix et les conditions avant d’envoyer la demande.", "CONFLICT");
      if (service && input.problemType && !service.problemTypes.includes(input.problemType)) fail("Le type de problème ne correspond pas à cette prestation.");
      const [client] = await tx.insert(s.clients).values({ userId: identity?.id || null, organizationId: input.organizationId, name: input.name, email: input.email, phone: input.phone }).$returningId();
      const reference = `MDS-${randomBytes(8).toString("hex").toUpperCase()}`;
      const trackingToken = secretHash(`tracking:${reference}:${idem}`, p.trackingSecret);
      const { idempotencyKey, consent, desiredStart, pricingFingerprint, ...fields } = input;
      const [created] = await tx.insert(s.requests).values({ ...fields, reference, trackingHash: hash(trackingToken), idempotencyHash: idem, payloadHash: payload, userId: identity?.id || null, clientId: client.id, serviceName: service?.name || null, desiredStart: desiredStart ? new Date(desiredStart) : null, pricingSnapshot: snapshot, durationMinutes: snapshot.durationMinutes, proposedPriceCents: snapshot.totalCents, consentAt: new Date(), status: service ? "awaiting_mds" : "to_analyze" }).$returningId();
      const r = await load(tx, created);
      await event(tx, r, "sent", "La demande a été déposée avec le consentement du client.", "client", identity?.id || null);
      await event(tx, r, r.status, service ? "La demande attend l’analyse et l’accord de MDS." : "Demande libre conservée pour analyse par MDS.", "system", null);
      await recordAudit(tx, identity?.id || null, "request.create", "request", r.id);
      return { id: r.id, reference, trackingToken };
    });
  }),
  claim: authenticated.input(trackSchema.extend({ token: z.string().min(16).max(100) })).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    return db.transaction(async tx => {
      const p = await principal(tx, true);
      const r = await load(tx, { reference: input.reference });
      if (!secureEqual(hash(input.token), r.trackingHash)) fail("La clé privée de cette demande est invalide.", "FORBIDDEN");
      if (r.organizationId) fail("Une demande d’organisation nécessite une appartenance autorisée, pas un rattachement individuel.", "FORBIDDEN");
      if (p.artisanUserId === ctx.user.id) fail("Le rattachement client n’est pas disponible pour l’artisan.", "FORBIDDEN");
      const [identity] = await tx.select().from(s.users).where(eq(s.users.id, ctx.user.id));
      if (!identity?.email || identity.email.trim().toLowerCase() !== r.email.trim().toLowerCase()) fail("L’email de votre identité OAuth doit correspondre à celui de la demande.", "FORBIDDEN");
      if (r.userId) {
        if (r.userId === ctx.user.id) return { success: true as const };
        fail("Cette demande est déjà rattachée à un autre compte.", "CONFLICT");
      }
      await expire(tx, r);
      await update(tx, r, { userId: ctx.user.id }, "client:claim");
      await tx.update(s.clients).set({ userId: ctx.user.id }).where(eq(s.clients.id, r.clientId));
      await tx.update(s.notifications).set({ userId: ctx.user.id }).where(and(eq(s.notifications.requestId, r.id), eq(s.notifications.audience, "client"), isNull(s.notifications.userId)));
      r.userId = ctx.user.id;
      await event(tx, r, r.status, "Le client a rattaché explicitement sa demande à son identité OAuth après vérification de sa clé privée et de son email.", "client", ctx.user.id);
      await recordAudit(tx, ctx.user.id, "request.claim", "request", r.id);
      return { success: true as const };
    });
  }),
  track: procedure.input(trackSchema).query(({ input, ctx }) => readDetail({ reference: input.reference }, ctx.user, input.token)),
  detail: authenticated.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => readDetail(input, ctx.user)),
  mine: authenticated.query(({ ctx }) => listScoped(ctx.user)),
  list: artisan.query(({ ctx }) => listScoped(ctx.user)),
  artisanAction: artisan.input(artisanActionSchema).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    const result = await db.transaction(async tx => {
      const p = await principal(tx, true);
      if (p.artisanUserId !== ctx.user.id) fail("Cet accès est réservé à l’artisan MDS.", "FORBIDDEN");
      const r = await load(tx, input);
      if (await expire(tx, r)) return { expired: true as const };
      checkVersion(r, input.version);
      const message = input.message?.trim();
      const actor = ctx.user.id;
      const emit = (status: RequestStatus, text: string) => event(tx, r, status, text, "artisan", actor);
      let patch: Partial<typeof s.requests.$inferInsert> = {};
      switch (input.action) {
        case "accept": case "propose": case "quote": {
          requireState(r, negotiableStates);
          const proposedStart = input.proposedStart ? new Date(input.proposedStart) : input.action === "propose" ? null : r.proposedStart || r.desiredStart;
          const price = input.priceCents ?? r.proposedPriceCents;
          const duration = input.durationMinutes ?? r.durationMinutes;
          if (input.action !== "quote") requireContractPrice(r, price);
          const times = slot(proposedStart, price, duration);
          await checkPlanning(tx, times);
          const expiry = new Date(Date.now() + p.proposalExpiryHours * 3600000);
          if (input.action !== "quote" && r.quoteStatus !== "none" && r.quoteStatus !== "accepted") fail("Ce dossier exige un devis distinct à accepter. Utilisez l’action devis.", "CONFLICT");
          if (input.action !== "quote" && r.quoteStatus === "accepted" && price !== r.proposedPriceCents) fail("Le prix du devis accepté ne peut pas être modifié sans nouveau devis.", "CONFLICT");
          patch = { proposedStart, proposedPriceCents: price, durationMinutes: duration, expiresAt: expiry, proposalMessage: message || null };
          if (input.action === "quote") {
            const [doc] = await tx.select().from(s.documents).where(and(eq(s.documents.requestId, r.id), eq(s.documents.kind, "quote"))).orderBy(s.documents.id);
            // Choose most recent unissued quote; an existing accepted/refused document cannot masquerade as a new one.
            const docs = await tx.select().from(s.documents).where(and(eq(s.documents.requestId, r.id), eq(s.documents.kind, "quote"))).orderBy(s.documents.id);
            const latest = docs.at(-1);
            if (!doc || !latest) fail("Ajoutez le vrai document de devis avant de le proposer au client.");
            const [used] = await tx.select().from(s.quotes).where(eq(s.quotes.documentId, latest.id));
            if (used) fail("Ce devis a déjà été proposé. Ajoutez un nouveau document pour une nouvelle proposition.", "CONFLICT");
            await tx.update(s.quotes).set({ status: "superseded" }).where(and(eq(s.quotes.requestId, r.id), inArray(s.quotes.status, ["pending", "accepted"])));
            await tx.insert(s.quotes).values({ requestId: r.id, documentId: latest.id, status: "pending" });
            patch.status = "quote_pending"; patch.quoteStatus = "pending";
            await emit("accepted_mds", "MDS a donné son accord sous réserve d’acceptation du devis et de confirmation client.");
            await emit("quote_pending", message || "Un devis réel est proposé. Son acceptation est distincte de la confirmation du rendez-vous.");
          } else if (input.action === "propose") {
            patch.status = "proposed_slot";
            await emit("proposed_slot", message || "MDS propose un nouveau créneau et un prix. Aucun rendez-vous n’est encore réservé.");
          } else {
            patch.status = "awaiting_client";
            await emit("accepted_mds", message || "MDS accepte la demande avec un créneau et un prix définis.");
            await emit("awaiting_client", "La confirmation du client est attendue. Aucun rendez-vous n’est encore réservé.");
          }
          break;
        }
        case "refuse":
          requireState(r, negotiableStates); patch = { status: "refused", expiresAt: null };
          await emit("refused", requireMessage(message, "Précisez le motif du refus.")); break;
        case "information":
          requireState(r, negotiableStates); patch = { status: "needs_information", expiresAt: null, proposalMessage: requireMessage(message, "Écrivez votre question au client.") };
          await emit("needs_information", patch.proposalMessage!); break;
        case "cancel":
          requireState(r, [...negotiableStates, "confirmed", "planned"]); patch = { status: "cancelled", expiresAt: null };
          await tx.update(s.appointments).set({ status: "cancelled" }).where(eq(s.appointments.requestId, r.id));
          await emit("cancelled", requireMessage(message, "Précisez le motif de l’annulation.")); break;
        case "start": {
          requireState(r, ["confirmed", "planned"]);
          const [appointment] = await tx.select().from(s.appointments).where(and(eq(s.appointments.requestId, r.id), eq(s.appointments.status, "confirmed")));
          if (!appointment) fail("Aucun rendez-vous confirmé ne permet de démarrer cette intervention.", "CONFLICT");
          const [intervention] = await tx.select().from(s.interventions).where(eq(s.interventions.requestId, r.id));
          if (!intervention) fail("L’intervention liée au rendez-vous est introuvable.", "CONFLICT");
          await tx.update(s.interventions).set({ startedAt: new Date() }).where(eq(s.interventions.id, intervention.id));
          await tx.update(s.appointments).set({ status: "in_progress" }).where(eq(s.appointments.id, appointment.id));
          patch.status = "in_progress"; await emit("in_progress", message || "L’artisan a déclaré le démarrage réel de l’intervention."); break;
        }
        case "complete":
          requireState(r, ["in_progress"]);
          await tx.update(s.interventions).set({ completedAt: new Date(), summary: message || null }).where(eq(s.interventions.requestId, r.id));
          await tx.update(s.appointments).set({ status: "completed" }).where(eq(s.appointments.requestId, r.id));
          patch.status = "completed"; await emit("completed", message || "L’artisan a déclaré l’intervention terminée."); break;
        case "invoice": {
          requireState(r, ["completed"]);
          if (r.proposedPriceCents === null || !Number.isSafeInteger(r.proposedPriceCents) || r.proposedPriceCents < 0) fail("Un montant contractuel validé est obligatoire avant de déclarer la facture. Aucun montant ne sera inventé.", "CONFLICT");
          requireContractPrice(r, r.proposedPriceCents);
          const docs = await tx.select().from(s.documents).where(and(eq(s.documents.requestId, r.id), eq(s.documents.kind, "invoice"))).orderBy(s.documents.id);
          const doc = docs.at(-1);
          if (!doc) fail("Ajoutez le vrai document de facture avant de déclarer son émission.");
          await tx.insert(s.invoices).values({ requestId: r.id, documentId: doc.id, amountCents: r.proposedPriceCents, currency: "EUR" });
          patch.status = "invoiced"; await emit("invoiced", message || "L’artisan a déclaré la facture émise ; le document est disponible dans le dossier."); break;
        }
        case "paid": {
          requireState(r, ["invoiced"]);
          const note = requireMessage(message, "Indiquez la vérification réelle du paiement hors ligne (mode, date ou référence). Cette action n’encaisse aucun paiement.");
          const [invoice] = await tx.select().from(s.invoices).where(eq(s.invoices.requestId, r.id)).for("update");
          if (!invoice || invoice.amountCents == null || !Number.isSafeInteger(invoice.amountCents) || invoice.amountCents < 0 || invoice.currency !== "EUR") fail("La facture doit avoir un montant réel validé et une devise EUR avant la vérification du paiement. Les anciennes factures sans montant exigent une nouvelle validation.", "CONFLICT");
          if (invoice.paidAt) fail("Cette facture est déjà réglée. Actualisez le dossier.", "CONFLICT");
          if (invoice.amountCents !== r.proposedPriceCents) fail("Le montant de la facture ne correspond pas au prix contractuel validé. Une nouvelle validation est nécessaire.", "CONFLICT");
          requireContractPrice(r, r.proposedPriceCents);
          const [livePending] = await tx.select({ id: s.payments.id }).from(s.payments).where(and(eq(s.payments.invoiceId, invoice.id), eq(s.payments.provider, "stripe"), eq(s.payments.mode, "live"), inArray(s.payments.status, ["pending", "failed"]))).limit(1).for("update");
          if (livePending) fail("Une session Stripe réelle reste réutilisable pour cette facture, même après un échec de carte. Faites vérifier ou expirer cette session avant de déclarer un paiement manuel, pour éviter un double règlement.", "CONFLICT");
          const confirmedAt = new Date();
          await tx.update(s.invoices).set({ paidAt: confirmedAt, paymentVerifiedBy: actor, verificationNote: note }).where(eq(s.invoices.id, invoice.id));
          await tx.insert(s.payments).values({ requestId: r.id, invoiceId: invoice.id, provider: "manual", mode: "offline", status: "succeeded", amountCents: invoice.amountCents, currency: "EUR", verifiedBy: actor, verificationNote: note, confirmedAt });
          patch.status = "paid"; await emit("paid", `Paiement vérifié explicitement par l’artisan : ${message}. L’application n’a pas encaissé ce paiement.`); break;
        }
        case "close":
          requireState(r, ["paid"]); patch.status = "closed"; await emit("closed", message || "L’artisan a clôturé le dossier après paiement vérifié."); break;
      }
      await update(tx, r, patch, `artisan:${input.action}`);
      await recordAudit(tx, actor, `request.artisan.${input.action}`, "request", r.id);
      return { expired: false as const };
    });
    if (result.expired) fail("La proposition a expiré et cet événement a été enregistré. Actualisez le dossier.", "CONFLICT");
    return { success: true as const };
  }),
  clientAction: procedure.input(clientActionSchema).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    const result = await db.transaction(async tx => {
      const p = await principal(tx, true);
      const r = await load(tx, { reference: input.reference });
      await authorizeRequest(tx, r, ctx.user, input.token);
      if (ctx.user?.id === p.artisanUserId) fail("La confirmation client doit être effectuée par le client, pas par l’artisan.", "FORBIDDEN");
      if (await expire(tx, r)) return { expired: true as const };
      if (input.action === "confirm" && r.lastAction === "client:confirm" && r.lastActionVersion === input.version && ["confirmed", "planned"].includes(r.status)) return { expired: false as const };
      checkVersion(r, input.version);
      const message = input.message?.trim();
      const actor = ctx.user && ctx.user.id > 0 ? ctx.user.id : null;
      const emit = (status: RequestStatus, text: string) => event(tx, r, status, text, "client", actor);
      let patch: Partial<typeof s.requests.$inferInsert> = {};
      switch (input.action) {
        case "confirm": {
          mayConfirm(r);
          requireContractPrice(r, r.proposedPriceCents);
          const times = slot(r.proposedStart, r.proposedPriceCents, r.durationMinutes);
          await checkPlanning(tx, times); // Global settings row lock makes overlapping confirmations mutually exclusive.
          const [appointment] = await tx.insert(s.appointments).values({ requestId: r.id, ...times, status: "confirmed" }).$returningId();
          await tx.insert(s.interventions).values({ requestId: r.id, appointmentId: appointment.id });
          patch = { status: "planned", expiresAt: null };
          await emit("confirmed", message || "Le client confirme le créneau et le prix après accord MDS.");
          await event(tx, r, "planned", "Le rendez-vous unique a été créé et l’intervention est planifiée.", "system", null); break;
        }
        case "acceptQuote": case "refuseQuote": {
          requireState(r, ["quote_pending"]);
          if (r.quoteStatus !== "pending") fail("Aucun devis n’attend de réponse.", "CONFLICT");
          const accepted = input.action === "acceptQuote";
          const [changed] = await tx.update(s.quotes).set({ status: accepted ? "accepted" : "refused", acceptedAt: accepted ? new Date() : null }).where(and(eq(s.quotes.requestId, r.id), eq(s.quotes.status, "pending")));
          if (changed.affectedRows !== 1) fail("Le devis courant est introuvable ou a changé.", "CONFLICT");
          patch = { status: accepted ? "awaiting_client" : "quote_refused", quoteStatus: accepted ? "accepted" : "refused", expiresAt: accepted ? r.expiresAt : null };
          await emit(accepted ? "quote_accepted" : "quote_refused", message || (accepted ? "Le client a accepté le devis. Le rendez-vous n’est pas encore confirmé." : "Le client a refusé le devis."));
          if (accepted) await event(tx, r, "awaiting_client", "Confirmez maintenant le rendez-vous pour réserver le créneau.", "system", null);
          break;
        }
        case "refuse":
          requireState(r, ["awaiting_client", "proposed_slot", "quote_pending", "quote_accepted"]); patch = { status: "refused", expiresAt: null };
          await emit("refused", message || "Le client a refusé la proposition MDS."); break;
        case "reschedule":
          requireState(r, negotiableStates);
          if (!input.desiredStart || new Date(input.desiredStart) <= new Date()) fail("Indiquez un nouveau créneau souhaité futur.");
          patch = { status: "awaiting_mds", desiredStart: new Date(input.desiredStart), proposedStart: null, expiresAt: null };
          await emit("awaiting_mds", message || "Le client demande un autre créneau. Un nouvel accord MDS sera nécessaire."); break;
        case "information":
          requireState(r, ["needs_information"]); patch = { status: r.serviceId ? "awaiting_mds" : "to_analyze", expiresAt: null };
          await emit(patch.status!, requireMessage(message, "Écrivez votre réponse à la question MDS.")); break;
        case "cancel":
          requireState(r, [...negotiableStates, "confirmed", "planned"]);
          patch = { status: "cancelled", expiresAt: null };
          await tx.update(s.appointments).set({ status: "cancelled" }).where(eq(s.appointments.requestId, r.id));
          await emit("cancelled", message || "Le client a annulé sa demande."); break;
      }
      await update(tx, r, patch, `client:${input.action}`);
      await recordAudit(tx, actor, `request.client.${input.action}`, "request", r.id);
      return { expired: false as const };
    });
    if (result.expired) fail("La proposition a expiré et cet événement a été enregistré. Demandez un nouvel accord MDS.", "CONFLICT");
    return { success: true as const };
  }),
});
