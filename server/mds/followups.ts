import { and, eq, lte } from "drizzle-orm";
import * as s from "../../drizzle/schema";
import type { RequestStatus } from "../../shared/mds";
import { principal, recordAudit, type Database } from "./common";
import { providerReadiness } from "./outbox";
import { fail } from "./workflow";

// Une relance programmée est toujours validée explicitement par l’artisan : le
// brouillon est relu, puis programmé. Rien n’est envoyé avant l’heure choisie,
// et rien n’est présenté comme « envoyé » tant que le fournisseur n’a pas
// accepté le message.

/** Délai minimal avant l’envoi, pour garder le temps de se raviser. */
export const MIN_LEAD_MINUTES = 5;
/** Une relance ne peut pas être programmée au-delà de cet horizon. */
export const MAX_LEAD_DAYS = 60;
/** Au-delà de ce retard, l’envoi est annulé plutôt que d’arriver hors de propos. */
export const MAX_LATE_HOURS = 24;

/** Dossiers pour lesquels une relance n’a plus de sens. */
const closedForFollowUp: readonly RequestStatus[] = [
  "refused",
  "cancelled",
  "paid",
  "closed",
];

export const followUpPresets = ["tomorrow", "three_days", "one_week"] as const;
export type FollowUpPreset = (typeof followUpPresets)[number];

const CHANNEL_UNAVAILABLE =
  "Canal externe non configuré ou désactivé dans MDS.";

export function channelEnabled(
  p: typeof s.settings.$inferSelect,
  channel: "email" | "sms"
) {
  const ready = providerReadiness();
  return channel === "email"
    ? p.emailEnabled && ready.email && !!p.emailFrom
    : p.smsEnabled && ready.sms && !!p.smsFrom;
}

const parisFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parisParts(date: Date) {
  const values = Object.fromEntries(
    parisFormat.formatToParts(date).map(part => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function parisOffsetMinutes(date: Date) {
  const p = parisParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Instant correspondant à l’heure murale donnée à Paris (gère l’heure d’été). */
function parisWallTime(year: number, month: number, day: number, hour: number) {
  const wall = Date.UTC(year, month - 1, day, hour, 0, 0);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    instant = wall - parisOffsetMinutes(new Date(instant)) * 60000;
  }
  return new Date(instant);
}

/** Convertit un choix simple de l’artisan en date d’envoi : 9 h à Paris. */
export function followUpDate(preset: FollowUpPreset, now = new Date()) {
  const days = { tomorrow: 1, three_days: 3, one_week: 7 }[preset];
  const today = parisParts(now);
  // Date.UTC normalise les débordements de mois et d’année.
  const target = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
  return parisWallTime(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
    9
  );
}

function isChannelMessage(channel: string): channel is "email" | "sms" {
  return channel === "email" || channel === "sms";
}

export async function scheduleFollowUp(
  db: Database,
  input: {
    actionId: number;
    sendAt: Date;
    actorId: number;
    now?: Date;
    /** Texte relu et éventuellement retouché par l’artisan : c’est lui qui partira. */
    subject?: string;
    body?: string;
  }
) {
  const now = input.now ?? new Date();
  const { sendAt } = input;
  if (!(sendAt instanceof Date) || Number.isNaN(sendAt.getTime()))
    fail("La date d’envoi n’est pas valide.", "BAD_REQUEST");
  if (sendAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60000)
    fail(
      "Choisissez un moment à venir : la relance ne peut pas partir tout de suite.",
      "BAD_REQUEST"
    );
  if (sendAt.getTime() > now.getTime() + MAX_LEAD_DAYS * 86400000)
    fail(
      `La relance ne peut pas être programmée à plus de ${MAX_LEAD_DAYS} jours.`,
      "BAD_REQUEST"
    );
  return db.transaction(async tx => {
    // Même mutex applicatif que les autres écritures MDS : deux programmations
    // simultanées passent l’une après l’autre.
    await principal(tx, true);
    const [action] = await tx
      .select()
      .from(s.assistantActions)
      .where(eq(s.assistantActions.id, input.actionId))
      .limit(1)
      .for("update");
    if (!action) fail("Cette proposition n’existe plus.", "NOT_FOUND");
    if (action.status !== "proposed")
      fail("Cette proposition a déjà été traitée.", "CONFLICT");
    if (action.actionType !== "follow_up")
      fail("Seules les relances client peuvent être programmées.", "CONFLICT");
    if (!isChannelMessage(action.channel))
      fail(
        "Les appels ne se programment pas : utilisez la fiche d’appel au moment voulu.",
        "CONFLICT"
      );
    if (!action.requestId)
      fail("Cette relance n’est liée à aucun dossier.", "CONFLICT");
    const [request] = await tx
      .select()
      .from(s.requests)
      .where(eq(s.requests.id, action.requestId))
      .limit(1)
      .for("update");
    if (!request) fail("Le dossier demandé est introuvable.", "NOT_FOUND");
    if (closedForFollowUp.includes(request.status))
      fail(
        "Ce dossier est terminé ou clos : il n’y a plus rien à relancer.",
        "CONFLICT"
      );
    const [already] = await tx
      .select({ id: s.assistantActions.id })
      .from(s.assistantActions)
      .where(
        and(
          eq(s.assistantActions.requestId, request.id),
          eq(s.assistantActions.actionType, "follow_up"),
          eq(s.assistantActions.channel, action.channel),
          eq(s.assistantActions.status, "scheduled")
        )
      )
      .limit(1)
      .for("update");
    if (already)
      fail(
        "Une relance est déjà programmée pour ce dossier sur ce canal. Annulez-la avant d’en programmer une autre.",
        "CONFLICT"
      );
    const [changed] = await tx
      .update(s.assistantActions)
      .set({
        status: "scheduled",
        scheduledFor: sendAt,
        approvedAt: now,
        completedAt: null,
        lastError: null,
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.body ? { body: input.body } : {}),
      })
      .where(
        and(
          eq(s.assistantActions.id, action.id),
          eq(s.assistantActions.status, "proposed")
        )
      );
    if (changed.affectedRows !== 1)
      fail("Cette proposition a déjà été traitée.", "CONFLICT");
    await recordAudit(
      tx,
      input.actorId,
      "assistant.followUp.schedule",
      "assistant_action",
      action.id
    );
    return {
      status: "scheduled" as const,
      scheduledFor: sendAt,
      reference: request.reference,
    };
  });
}

export async function unscheduleFollowUp(
  db: Database,
  input: { actionId: number; actorId: number; now?: Date }
) {
  const now = input.now ?? new Date();
  return db.transaction(async tx => {
    const [changed] = await tx
      .update(s.assistantActions)
      .set({
        status: "cancelled",
        completedAt: now,
        lastError: "Annulée par l’artisan avant l’envoi.",
      })
      .where(
        and(
          eq(s.assistantActions.id, input.actionId),
          eq(s.assistantActions.status, "scheduled")
        )
      );
    if (changed.affectedRows !== 1)
      fail(
        "Cette relance n’est plus programmée : elle a déjà été envoyée ou annulée.",
        "CONFLICT"
      );
    await recordAudit(
      tx,
      input.actorId,
      "assistant.followUp.unschedule",
      "assistant_action",
      input.actionId
    );
    return { status: "cancelled" as const };
  });
}

type DispatchOutcome = "queued" | "failed" | "cancelled" | "skipped";

/**
 * Place dans la file d’envoi les relances arrivées à échéance. Chaque relance
 * est traitée dans sa propre transaction : une anomalie isolée n’empêche pas
 * les autres, et un second passage ne peut ni dupliquer ni renvoyer.
 */
export async function dispatchDueFollowUps(
  db: Database,
  now: Date,
  actorId: number | null
) {
  const due = await db
    .select({ id: s.assistantActions.id })
    .from(s.assistantActions)
    .where(
      and(
        eq(s.assistantActions.status, "scheduled"),
        lte(s.assistantActions.scheduledFor, now)
      )
    )
    .limit(50);
  const totals = { queued: 0, failed: 0, cancelled: 0 };
  for (const { id } of due) {
    let outcome: DispatchOutcome = "skipped";
    try {
      outcome = await db.transaction(async (tx): Promise<DispatchOutcome> => {
        // Deux exécutions simultanées (planifiée et manuelle) ne peuvent pas
        // mettre la même relance deux fois en file.
        const p = await principal(tx, true);
        const [action] = await tx
          .select()
          .from(s.assistantActions)
          .where(eq(s.assistantActions.id, id))
          .limit(1)
          .for("update");
        if (
          !action ||
          action.status !== "scheduled" ||
          !action.scheduledFor ||
          action.scheduledFor.getTime() > now.getTime() ||
          !isChannelMessage(action.channel)
        )
          return "skipped";
        const cancel = async (reason: string): Promise<DispatchOutcome> => {
          await tx
            .update(s.assistantActions)
            .set({ status: "cancelled", completedAt: now, lastError: reason })
            .where(eq(s.assistantActions.id, action.id));
          await recordAudit(
            tx,
            actorId,
            "assistant.followUp.skipped",
            "assistant_action",
            action.id
          );
          return "cancelled";
        };
        if (
          now.getTime() - action.scheduledFor.getTime() >
          MAX_LATE_HOURS * 3600000
        )
          return cancel(
            `Relance non envoyée : l’heure prévue est dépassée de plus de ${MAX_LATE_HOURS} h.`
          );
        const [request] = action.requestId
          ? await tx
              .select()
              .from(s.requests)
              .where(eq(s.requests.id, action.requestId))
              .limit(1)
              .for("update")
          : [];
        if (!request || closedForFollowUp.includes(request.status))
          return cancel(
            "Relance non envoyée : le dossier est terminé ou clos depuis la programmation."
          );
        const enabled = channelEnabled(p, action.channel);
        const dedupeKey = `assistant-action:${action.id}`;
        const [queued] = await tx
          .select({ id: s.messageOutbox.id })
          .from(s.messageOutbox)
          .where(eq(s.messageOutbox.dedupeKey, dedupeKey))
          .limit(1);
        if (!queued)
          await tx.insert(s.messageOutbox).values({
            dedupeKey,
            requestId: action.requestId,
            userId: null,
            organizationId: null,
            channel: action.channel,
            recipient: action.recipient,
            subject: action.subject,
            body: action.body,
            status: enabled ? "queued" : "disabled",
            lastError: enabled ? null : CHANNEL_UNAVAILABLE,
          });
        await tx
          .update(s.assistantActions)
          .set({
            status: enabled ? "approved" : "failed",
            completedAt: enabled ? null : now,
            lastError: enabled ? null : CHANNEL_UNAVAILABLE,
          })
          .where(eq(s.assistantActions.id, action.id));
        await recordAudit(
          tx,
          actorId,
          "assistant.followUp.dispatch",
          "assistant_action",
          action.id
        );
        return enabled ? "queued" : "failed";
      });
    } catch {
      // Une anomalie isolée laisse la relance programmée ; elle sera
      // reprise au prochain passage sans doublon possible.
      outcome = "skipped";
    }
    if (outcome !== "skipped") totals[outcome]++;
  }
  return totals;
}

/**
 * Reporte sur les actions de l’assistante l’état réel de la file d’envoi.
 * Une action n’est « envoyée » que lorsque le fournisseur a accepté le message.
 */
export async function syncAssistantActions(db: Database, now = new Date()) {
  const waiting = await db
    .select({
      id: s.assistantActions.id,
    })
    .from(s.assistantActions)
    .where(eq(s.assistantActions.status, "approved"))
    .limit(100);
  let sent = 0,
    failed = 0;
  for (const { id } of waiting) {
    const [row] = await db
      .select({
        status: s.messageOutbox.status,
        lastError: s.messageOutbox.lastError,
      })
      .from(s.messageOutbox)
      .where(eq(s.messageOutbox.dedupeKey, `assistant-action:${id}`))
      .limit(1);
    if (!row) continue;
    let next: { status: "sent" | "failed"; lastError: string | null } | null =
      null;
    if (row.status === "accepted" || row.status === "delivered")
      next = { status: "sent", lastError: null };
    else if (["failed", "disabled", "cancelled"].includes(row.status))
      next = {
        status: "failed",
        lastError: row.lastError || "Le fournisseur a refusé le message.",
      };
    else if (row.status === "uncertain")
      next = {
        status: "failed",
        lastError:
          "L’envoi n’a pas pu être confirmé : vérifiez avec le client avant de relancer.",
      };
    if (!next) continue;
    const [changed] = await db
      .update(s.assistantActions)
      .set({ ...next, completedAt: now })
      .where(
        and(
          eq(s.assistantActions.id, id),
          eq(s.assistantActions.status, "approved")
        )
      );
    if (changed.affectedRows !== 1) continue;
    if (next.status === "sent") sent++;
    else failed++;
  }
  return { sent, failed };
}
