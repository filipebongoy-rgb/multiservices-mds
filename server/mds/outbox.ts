import { and, eq, inArray, lte, or, isNull } from "drizzle-orm";
import * as s from "../../drizzle/schema";
import type { SqlDb } from "./common";
import { createHmac } from "node:crypto";
import { dateTime, statusLabels, type RequestStatus } from "../../shared/mds";
import { notifyOwner } from "../_core/notification";

export function providerReadiness() {
  return {
    email: !!process.env.MDS_RESEND_API_KEY,
    sms: !!(
      process.env.MDS_TWILIO_ACCOUNT_SID && process.env.MDS_TWILIO_AUTH_TOKEN
    ),
    emailProvider: "Resend",
    smsProvider: "Twilio",
  };
}
export function safeOrigin(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash
      ? u.origin
      : null;
  } catch {
    return null;
  }
}
export function trackingMessageLink(
  request: s.MdsRequest,
  p: typeof s.settings.$inferSelect
) {
  const origin = safeOrigin(p.publicOrigin);
  if (!origin) return null;
  const base = `${origin}/suivi?ref=${encodeURIComponent(request.reference)}`;
  if (request.organizationId || !p.trackingSecret) return base;
  const key = createHmac("sha256", Buffer.from(p.trackingSecret, "hex"))
    .update(`tracking:${request.reference}:${request.idempotencyHash}`)
    .digest("hex");
  return `${base}#cle=${key}`;
}
function shortStatus(status: RequestStatus, request: s.MdsRequest) {
  const values: Partial<Record<RequestStatus, string>> = {
    sent: "Votre demande est reçue.",
    awaiting_mds: "Votre demande attend MDS.",
    to_analyze: "MDS analysera votre problème.",
    accepted_mds: "MDS a accepté votre demande.",
    awaiting_client: "Votre accord est attendu.",
    proposed_slot: "MDS propose un nouveau créneau.",
    needs_information: "MDS a une question pour vous.",
    confirmed: `Rendez-vous confirmé : ${dateTime(request.proposedStart)}.`,
    planned: "Votre intervention est planifiée.",
    en_route: "L’artisan a déclaré son départ.",
    in_progress: "L’intervention a commencé.",
    completed: "L’intervention est terminée.",
    invoiced: "Votre facture est disponible.",
    paid: "Le règlement de votre facture est confirmé.",
    closed: "Votre dossier est clôturé.",
    expired: "La proposition a expiré. Demandez un nouvel accord.",
    quote_pending: "Votre devis est disponible.",
    quote_accepted: "Votre devis a été accepté.",
    quote_refused: "Votre devis a été refusé.",
    cancelled: "Votre demande est annulée.",
    refused: "Votre demande a été refusée.",
  };
  return values[status] || "Votre dossier a été mis à jour.";
}
export async function enqueueEventMessages(
  db: SqlDb,
  request: s.MdsRequest,
  p: typeof s.settings.$inferSelect,
  eventId: number,
  status: RequestStatus,
  message: string,
  actor: "client" | "artisan" | "system",
  notificationTitle?: string
) {
  const ready = providerReadiness();
  const link = trackingMessageLink(request, p);
  const title = `MDS · ${notificationTitle || statusLabels[status]}`;
  // A self-authored event should not send the same notification back to its author.
  const audiences: {
    name: string;
    email: string;
    phone: string;
    userId: number | null;
    organizationId: number | null;
    body: string;
  }[] = [];
  if (actor !== "artisan" && p.artisanUserId)
    audiences.push({
      name: "artisan",
      email: p.contactEmail,
      phone: p.contactPhone,
      userId: p.artisanUserId,
      organizationId: null,
      body: `${request.reference} : ${message.slice(0, 180)}${safeOrigin(p.publicOrigin) ? ` ${safeOrigin(p.publicOrigin)}/artisan` : ""}`,
    });
  if (actor !== "client")
    audiences.push({
      name: "client",
      email: request.email,
      phone: request.phone,
      userId: request.userId,
      organizationId: request.organizationId,
      body: `${request.reference} : ${(message || shortStatus(status, request)).slice(0, 220)}${link ? ` ${link}` : ""}`,
    });
  for (const a of audiences)
    for (const channel of ["email", "sms"] as const) {
      const enabled = channel === "email" ? p.emailEnabled : p.smsEnabled;
      if (!enabled) continue;
      const recipient = channel === "email" ? a.email : a.phone;
      if (!recipient) continue;
      const dedupeKey = `event:${eventId}:${a.name}:${channel}`;
      const [old] = await db
        .select({ id: s.messageOutbox.id })
        .from(s.messageOutbox)
        .where(eq(s.messageOutbox.dedupeKey, dedupeKey));
      if (old) continue;
      const configured =
        ready[channel] &&
        !!link &&
        (channel === "email" ? !!p.emailFrom : !!p.smsFrom);
      await db.insert(s.messageOutbox).values({
        dedupeKey,
        requestId: request.id,
        userId: a.userId,
        organizationId: a.organizationId,
        channel,
        recipient,
        subject: title.slice(0, 200),
        body: a.body,
        status: configured ? "queued" : "disabled",
        lastError: configured
          ? null
          : "Canal ou adresse de suivi non configuré.",
      });
    }
  if (actor !== "artisan") {
    try {
      await notifyOwner({
        title: `[MDS] ${title.slice(0, 100)}`,
        content:
          `${request.name || "Nouveau client"} : ${(message || statusLabels[status] || "").slice(0, 200)} — ${request.phone || ""}, ${request.city || ""}. Ouvrez l’espace artisan pour répondre.`.slice(
            0,
            500
          ),
      });
    } catch {
      // owner notification failure must never block the business event
    }
  }
}
type ProviderResult = { status: "accepted" | "delivered"; id: string };
class ProviderFailure extends Error {
  constructor(
    public uncertain: boolean,
    public retryable: boolean,
    public safeMessage: string
  ) {
    super(safeMessage);
  }
}
export function normalizeSmsPhone(phone: string) {
  const n = phone.replace(/[\s().-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(n)) return n;
  // No country code is inferred. Client numbers must be explicit for a provider send.
  return null;
}
export async function deliverMessage(
  row: typeof s.messageOutbox.$inferSelect,
  p: typeof s.settings.$inferSelect
): Promise<ProviderResult> {
  const signal = AbortSignal.timeout(15000);
  let response: Response;
  try {
    if (row.channel === "email") {
      if (!p.emailEnabled || !process.env.MDS_RESEND_API_KEY || !p.emailFrom)
        throw new ProviderFailure(
          false,
          false,
          "Canal e-mail désactivé ou incomplet."
        );
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${process.env.MDS_RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `mds-${row.dedupeKey}`,
        },
        body: JSON.stringify({
          from: p.emailFrom,
          to: [row.recipient],
          subject: row.subject,
          text: row.body,
        }),
      });
    } else {
      const sid = process.env.MDS_TWILIO_ACCOUNT_SID,
        token = process.env.MDS_TWILIO_AUTH_TOKEN,
        phone = normalizeSmsPhone(row.recipient);
      if (!p.smsEnabled || !sid || !token || !p.smsFrom)
        throw new ProviderFailure(
          false,
          false,
          "Canal SMS désactivé ou incomplet."
        );
      if (!/^AC[a-f0-9]{32}$/i.test(sid) || !phone)
        throw new ProviderFailure(
          false,
          false,
          "Numéro SMS attendu au format international +33… et compte valide."
        );
      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        {
          method: "POST",
          signal,
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: phone,
            From: p.smsFrom,
            Body: row.body,
          }),
        }
      );
    }
  } catch (e) {
    if (e instanceof ProviderFailure) throw e;
    throw new ProviderFailure(
      true,
      false,
      "Résultat fournisseur inconnu. Vérifiez le fournisseur avant toute reprise pour éviter un doublon."
    );
  }
  if (!response.ok) {
    const retryable = response.status === 429;
    throw new ProviderFailure(
      response.status >= 500,
      retryable,
      `Fournisseur ${row.channel} : réponse ${response.status}.`
    );
  }
  const result: unknown = await response.json().catch(() => null);
  const value = result as { id?: string; sid?: string; status?: string };
  const id = row.channel === "email" ? value?.id : value?.sid;
  if (!id)
    throw new ProviderFailure(
      true,
      false,
      "Le fournisseur n’a pas fourni d’identifiant vérifiable."
    );
  return {
    id,
    status:
      row.channel === "sms" && value.status === "delivered"
        ? "delivered"
        : "accepted",
  };
}
export async function processOutbox(
  db: SqlDb,
  p: typeof s.settings.$inferSelect,
  maximum = 20
) {
  let accepted = 0,
    failed = 0,
    uncertain = 0;
  const now = new Date();
  // A crashed worker may have sent its message. It must not resend an unverified side effect.
  const abandoned = await db
    .select()
    .from(s.messageOutbox)
    .where(
      and(
        eq(s.messageOutbox.status, "sending"),
        lte(s.messageOutbox.leaseUntil, now)
      )
    )
    .limit(maximum);
  for (const row of abandoned) {
    const [abandonedClaim] = await db
      .update(s.messageOutbox)
      .set({
        status: "uncertain",
        leaseUntil: null,
        lastError:
          "Traitement interrompu : vérifier le fournisseur avant reprise.",
      })
      .where(
        and(
          eq(s.messageOutbox.id, row.id),
          eq(s.messageOutbox.status, "sending"),
          eq(s.messageOutbox.attempts, row.attempts),
          lte(s.messageOutbox.leaseUntil, now)
        )
      );
    if (abandonedClaim.affectedRows === 1) uncertain++;
  }
  const rows = await db
    .select()
    .from(s.messageOutbox)
    .where(
      and(
        eq(s.messageOutbox.status, "queued"),
        or(
          isNull(s.messageOutbox.nextAttemptAt),
          lte(s.messageOutbox.nextAttemptAt, now)
        )
      )
    )
    .orderBy(s.messageOutbox.id)
    .limit(maximum);
  for (const row of rows) {
    if (row.channel === "email" ? !p.emailEnabled : !p.smsEnabled) {
      await db
        .update(s.messageOutbox)
        .set({ status: "disabled", lastError: "Canal désactivé par MDS." })
        .where(
          and(
            eq(s.messageOutbox.id, row.id),
            eq(s.messageOutbox.status, "queued"),
            eq(s.messageOutbox.attempts, row.attempts)
          )
        );
      continue;
    }
    const [claim] = await db
      .update(s.messageOutbox)
      .set({
        status: "sending",
        attempts: row.attempts + 1,
        leaseUntil: new Date(Date.now() + 60000),
      })
      .where(
        and(
          eq(s.messageOutbox.id, row.id),
          eq(s.messageOutbox.status, "queued"),
          eq(s.messageOutbox.attempts, row.attempts)
        )
      );
    if (claim.affectedRows !== 1) continue;
    try {
      const sent = await deliverMessage(row, p);
      const [completedClaim] = await db
        .update(s.messageOutbox)
        .set({
          status: sent.status,
          providerId: sent.id,
          acceptedAt: new Date(),
          deliveredAt: sent.status === "delivered" ? new Date() : null,
          leaseUntil: null,
          nextAttemptAt: null,
          lastError: null,
        })
        .where(
          and(
            eq(s.messageOutbox.id, row.id),
            eq(s.messageOutbox.status, "sending"),
            eq(s.messageOutbox.attempts, row.attempts + 1)
          )
        );
      if (completedClaim.affectedRows === 1) accepted++;
      else uncertain++;
    } catch (e) {
      const failure =
        e instanceof ProviderFailure
          ? e
          : new ProviderFailure(true, false, "Résultat fournisseur inconnu.");
      const retry = failure.retryable && row.attempts < 2;
      const status = failure.uncertain
        ? "uncertain"
        : retry
          ? "queued"
          : "failed";
      const [failedClaim] = await db
        .update(s.messageOutbox)
        .set({
          status,
          lastError: failure.safeMessage,
          leaseUntil: null,
          nextAttemptAt: retry
            ? new Date(Date.now() + 60000 * 2 ** row.attempts)
            : null,
        })
        .where(
          and(
            eq(s.messageOutbox.id, row.id),
            eq(s.messageOutbox.status, "sending"),
            eq(s.messageOutbox.attempts, row.attempts + 1)
          )
        );
      if (failedClaim.affectedRows === 1) {
        if (failure.uncertain) uncertain++;
        else failed++;
      }
    }
  }
  return {
    messagesAccepted: accepted,
    messagesFailed: failed,
    messagesUncertain: uncertain,
  };
}

export async function retrieveMessageStatus(
  row: typeof s.messageOutbox.$inferSelect
): Promise<{
  status: "accepted" | "delivered" | "failed";
  note: string | null;
}> {
  if (!row.providerId)
    throw Error("Ce message n’a pas d’identifiant fournisseur.");
  let response: Response;
  if (row.channel === "email") {
    if (!process.env.MDS_RESEND_API_KEY)
      throw Error("Canal e-mail non configuré.");
    response = await fetch(
      `https://api.resend.com/emails/${encodeURIComponent(row.providerId)}`,
      {
        headers: { Authorization: `Bearer ${process.env.MDS_RESEND_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      }
    );
  } else {
    const sid = process.env.MDS_TWILIO_ACCOUNT_SID,
      token = process.env.MDS_TWILIO_AUTH_TOKEN;
    if (
      !sid ||
      !token ||
      !/^AC[a-f0-9]{32}$/i.test(sid) ||
      !/^SM[a-f0-9]{32}$/i.test(row.providerId)
    )
      throw Error("Canal SMS non configuré ou identifiant invalide.");
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${row.providerId}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(10000),
      }
    );
  }
  if (!response.ok)
    throw Error(`Relecture fournisseur : réponse ${response.status}.`);
  const result = (await response.json()) as {
    id?: string;
    sid?: string;
    last_event?: string;
    status?: string;
    to?: string[] | string;
  };
  const providerId = row.channel === "email" ? result.id : result.sid;
  if (providerId !== row.providerId)
    throw Error("La preuve fournisseur ne correspond pas au message.");
  const recipients = Array.isArray(result.to) ? result.to : [result.to || ""];
  if (
    !recipients.some(r =>
      row.channel === "email"
        ? r.toLowerCase() === row.recipient.toLowerCase()
        : normalizeSmsPhone(r) === normalizeSmsPhone(row.recipient)
    )
  )
    throw Error("La preuve fournisseur ne correspond pas au destinataire.");
  const status = row.channel === "email" ? result.last_event : result.status;
  if (status === "delivered") return { status: "delivered", note: null };
  if (
    ["bounced", "failed", "undelivered", "canceled", "complained"].includes(
      status || ""
    )
  )
    return {
      status: "failed",
      note: "Le fournisseur a confirmé une livraison non réussie.",
    };
  return { status: "accepted", note: null };
}
