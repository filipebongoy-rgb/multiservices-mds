import { randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { jwtVerify } from "jose";
import { parse } from "cookie";
import type { Express, Request } from "express";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import {
  artisan,
  dbRequired,
  event,
  principal,
  recordAudit,
  type Database,
} from "./common";
import { fail, proposalStates } from "./workflow";
import { autoConfirmRequest, expireRequest } from "./requests";
import { dispatchDueFollowUps, syncAssistantActions } from "./followups";
import {
  processOutbox,
  providerReadiness,
  safeOrigin,
  retrieveMessageStatus,
} from "./outbox";

/**
 * Déclencheur externe (hébergement hors Manus) : un cron gratuit appelle
 * l’endpoint avec `Authorization: Bearer <MDS_CRON_SECRET>`. Le secret doit
 * faire au moins 32 caractères ; sans lui, cette voie reste fermée.
 */
export const EXTERNAL_CRON_TASK = "external-cron";
const MIN_CRON_SECRET_LENGTH = 32;
export function externalCronAuthorized(req: Pick<Request, "headers">) {
  const secret = process.env.MDS_CRON_SECRET ?? "";
  if (secret.length < MIN_CRON_SECRET_LENGTH) return false;
  const header = req.headers.authorization ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function scheduledIdentity(req: Pick<Request, "headers">) {
  if (externalCronAuthorized(req)) return EXTERNAL_CRON_TASK;
  const token = parse(req.headers.cookie || "").app_session_id;
  const secret = process.env.MANUS_JWT_SECRET,
    projectId = process.env.MANUS_PROJECT_ID,
    base = process.env.MANUS_OAUTH_API_URL;
  if (!token || !secret || !projectId || !base)
    throw Error("Identité planifiée absente.");
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"],
  });
  if (
    payload.appId !== projectId ||
    typeof payload.openId !== "string" ||
    !payload.openId.startsWith("cron_") ||
    typeof payload.exp !== "number" ||
    payload.exp <= Date.now() / 1000
  )
    throw Error("Identité planifiée invalide.");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt_token: token, project_id: projectId }),
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!response.ok) throw Error("Identité planifiée non vérifiée.");
  const identity = (await response.json()) as {
    openId?: string;
    projectId?: string;
    taskUid?: string;
  };
  if (
    identity.projectId !== projectId ||
    identity.openId !== payload.openId ||
    !identity.taskUid
  )
    throw Error("Tâche planifiée non vérifiée.");
  return identity.taskUid;
}
export async function runAutomation(
  db: Database,
  source: "manual" | "scheduled",
  taskUid: string | null,
  actorId: number | null,
  now = new Date()
) {
  const runKey =
    source === "scheduled"
      ? `${taskUid}:${now.toISOString().slice(0, 16)}`
      : `manual:${randomUUID()}`;
  const run = await db.transaction(async tx => {
    await principal(tx, true);
    if (source === "scheduled") {
      const [task] = await tx
        .select()
        .from(s.automationTasks)
        .where(
          and(
            eq(s.automationTasks.taskUid, taskUid!),
            eq(s.automationTasks.enabled, true)
          )
        );
      if (!task)
        fail("Cette tâche autonome n’est pas activée pour MDS.", "FORBIDDEN");
    }
    const [old] = await tx
      .select()
      .from(s.automationRuns)
      .where(eq(s.automationRuns.runKey, runKey));
    if (old && old.status !== "failed") return { id: old.id, duplicate: true };
    if (old) {
      await tx
        .update(s.automationRuns)
        .set({
          status: "running",
          error: null,
          finishedAt: null,
          startedAt: now,
        })
        .where(eq(s.automationRuns.id, old.id));
      return { id: old.id, duplicate: false };
    }
    const [created] = await tx
      .insert(s.automationRuns)
      .values({ runKey, taskUid, source, status: "running", startedAt: now })
      .$returningId();
    return { id: created.id, duplicate: false };
  });
  if (run.duplicate)
    return {
      duplicate: true,
      expired: 0,
      extrasExpired: 0,
      reminders: 0,
      appointmentsConfirmed: 0,
      requestsClosed: 0,
      followUpsQueued: 0,
      followUpsFailed: 0,
      followUpsCancelled: 0,
      messagesAccepted: 0,
      messagesFailed: 0,
      messagesUncertain: 0,
    };
  try {
    const summary = await db.transaction(async tx => {
      const p = await principal(tx, true);
      let expired = 0,
        extrasExpired = 0,
        reminderCount = 0;
      const proposals = await tx
        .select()
        .from(s.requests)
        .where(
          and(
            inArray(s.requests.status, proposalStates),
            lte(s.requests.expiresAt, now)
          )
        )
        .limit(200)
        .for("update");
      for (const r of proposals) if (await expireRequest(tx, r)) expired++;
      const extras = await tx
        .select()
        .from(s.extraWorks)
        .where(
          and(
            eq(s.extraWorks.status, "pending"),
            lte(s.extraWorks.expiresAt, now)
          )
        )
        .limit(200)
        .for("update");
      for (const extra of extras) {
        const [r] = await tx
          .select()
          .from(s.requests)
          .where(eq(s.requests.id, extra.requestId))
          .for("update");
        if (!r) continue;
        await tx
          .update(s.extraWorks)
          .set({ status: "cancelled", version: extra.version + 1 })
          .where(
            and(
              eq(s.extraWorks.id, extra.id),
              eq(s.extraWorks.version, extra.version)
            )
          );
        await event(
          tx,
          r,
          r.status,
          "La proposition de travaux supplémentaires a expiré sans accord. Aucun supplément n’est autorisé.",
          "system",
          null
        );
        await tx
          .update(s.requests)
          .set({ version: r.version + 1 })
          .where(eq(s.requests.id, r.id));
        extrasExpired++;
      }
      if (p.remindersEnabled) {
        const rows = await tx
          .select()
          .from(s.requests)
          .where(
            inArray(s.requests.status, [
              ...proposalStates,
              "planned",
              "confirmed",
            ])
          )
          .limit(500);
        for (const r of rows) {
          let kind: "proposal" | "appointment",
            dueAt: Date,
            key: string,
            text: string;
          if (proposalStates.includes(r.status) && r.expiresAt) {
            dueAt = new Date(
              r.expiresAt.getTime() - p.proposalReminderHours * 3600000
            );
            kind = "proposal";
            key = `proposal:${r.id}:${r.expiresAt.toISOString()}`;
            if (now >= r.expiresAt) continue;
            text =
              "Rappel : votre accord est attendu avant l’expiration de la proposition. Consultez votre suivi.";
          } else {
            const [appointment] = await tx
              .select()
              .from(s.appointments)
              .where(
                and(
                  eq(s.appointments.requestId, r.id),
                  eq(s.appointments.status, "confirmed")
                )
              );
            if (!appointment || appointment.startAt <= now) continue;
            dueAt = new Date(
              appointment.startAt.getTime() - p.reminderHours * 3600000
            );
            kind = "appointment";
            key = `appointment:${appointment.id}:${appointment.startAt.toISOString()}`;
            text =
              "Rappel : votre rendez-vous MDS approche. Consultez le créneau confirmé dans votre suivi.";
          }
          if (dueAt > now) continue;
          const [old] = await tx
            .select()
            .from(s.reminders)
            .where(eq(s.reminders.dedupeKey, key));
          if (old?.sentAt) continue;
          if (old)
            await tx
              .update(s.reminders)
              .set({ sentAt: now })
              .where(eq(s.reminders.id, old.id));
          else
            await tx.insert(s.reminders).values({
              dedupeKey: key,
              requestId: r.id,
              kind,
              dueAt,
              sentAt: now,
            });
          await event(tx, r, r.status, text, "system", null);
          reminderCount++;
        }
      }
      return { expired, extrasExpired, reminders: reminderCount };
    });
    let appointmentsConfirmed = 0;
    let requestsClosed = 0;
    const [settings] = await db.select().from(s.settings).limit(1);
    const actor = actorId ?? settings?.artisanUserId ?? null;
    if (actor) {
      const readyToConfirm = await db
        .select({ id: s.requests.id, proposedStart: s.requests.proposedStart, quoteStatus: s.requests.quoteStatus })
        .from(s.requests)
        .where(inArray(s.requests.status, ["proposed_slot", "awaiting_client"]))
        .limit(50);
      for (const request of readyToConfirm) {
        if (!request.proposedStart || request.quoteStatus === "pending" || request.quoteStatus === "refused") continue;
        try {
          await autoConfirmRequest(request.id, actor);
          appointmentsConfirmed++;
        } catch {
          // Le dossier reste visible dans l’atelier si une condition métier manque.
        }
      }
      const paidRequests = await db
        .select({ id: s.requests.id })
        .from(s.requests)
        .where(eq(s.requests.status, "paid"))
        .limit(100);
      for (const candidate of paidRequests) {
        try {
          const closed = await db.transaction(async tx => {
            const [request] = await tx.select().from(s.requests).where(eq(s.requests.id, candidate.id)).limit(1).for("update");
            if (!request || request.status !== "paid") return false;
            const [intervention] = await tx.select().from(s.interventions).where(eq(s.interventions.requestId, request.id)).limit(1);
            if (!intervention?.completedAt || !intervention.clientConfirmedAt) return false;
            const [afterPhoto] = await tx.select({ id: s.documents.id }).from(s.documents).where(and(eq(s.documents.requestId, request.id), eq(s.documents.kind, "photo"), eq(s.documents.photoStage, "after"))).limit(1);
            if (!afterPhoto) return false;
            await tx.update(s.requests).set({ status: "closed", version: request.version + 1, lastAction: "assistant:autoValidate", lastActionVersion: request.version + 1 }).where(and(eq(s.requests.id, request.id), eq(s.requests.version, request.version)));
            await event(tx, request, "closed", "Dossier clôturé automatiquement : paiement, intervention, preuve photo et confirmation client vérifiés.", "system", actor);
            await recordAudit(tx, actor, "assistant.request.autoValidate.scheduled", "request", request.id);
            return true;
          });
          if (closed) requestsClosed++;
        } catch {
          // Une anomalie isolée ne bloque pas le contrôle des autres dossiers.
        }
      }
    }
    const acceptedMessages = await db
      .select()
      .from(s.messageOutbox)
      .where(eq(s.messageOutbox.status, "accepted"))
      .limit(5);
    for (const row of acceptedMessages) {
      try {
        const status = await retrieveMessageStatus(row);
        await db
          .update(s.messageOutbox)
          .set({
            status: status.status,
            deliveredAt: status.status === "delivered" ? new Date() : null,
            lastError: status.note,
          })
          .where(
            and(
              eq(s.messageOutbox.id, row.id),
              eq(s.messageOutbox.status, "accepted")
            )
          );
      } catch {
        /* Preserve the last verified state without a false failure or resend. */
      }
    }
    // Les relances programmées échues rejoignent la file d’envoi avant son traitement.
    const followUps = await dispatchDueFollowUps(db, now, actor);
    const external = await processOutbox(db, await principal(db), 10);
    // L’action de l’assistante ne devient « envoyée » que si le fournisseur a accepté le message.
    await syncAssistantActions(db, now);
    const result = {
      ...summary,
      appointmentsConfirmed,
      requestsClosed,
      followUpsQueued: followUps.queued,
      followUpsFailed: followUps.failed,
      followUpsCancelled: followUps.cancelled,
      ...external,
    };
    await db
      .update(s.automationRuns)
      .set({ status: "succeeded", summary: result, finishedAt: new Date() })
      .where(eq(s.automationRuns.id, run.id));
    if (taskUid)
      await db
        .update(s.automationTasks)
        .set({ lastRunAt: new Date() })
        .where(eq(s.automationTasks.taskUid, taskUid));
    await recordAudit(
      db,
      actorId,
      `automation.${source}.run`,
      "automationRun",
      run.id
    );
    return { duplicate: false, ...result };
  } catch (e) {
    await db
      .update(s.automationRuns)
      .set({
        status: "failed",
        error:
          "Le traitement n’a pas abouti. Les effets déjà enregistrés restent dédupliqués.",
        finishedAt: new Date(),
      })
      .where(eq(s.automationRuns.id, run.id));
    throw e;
  }
}
const configuration = z.object({
  remindersEnabled: z.boolean(),
  reminderHours: z.number().int().min(1).max(168),
  proposalReminderHours: z.number().int().min(1).max(168),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  publicOrigin: z.string().max(1000),
  emailFrom: z.union([z.literal(""), z.email().max(320)]),
  smsFrom: z.string().max(80),
});
export const automationRouter = router({
  get: artisan.query(async () => {
    const db = await dbRequired(),
      p = await principal(db);
    const [task] = await db
      .select()
      .from(s.automationTasks)
      .where(eq(s.automationTasks.id, 1));
    const outbox = await db
      .select({
        id: s.messageOutbox.id,
        channel: s.messageOutbox.channel,
        subject: s.messageOutbox.subject,
        status: s.messageOutbox.status,
        attempts: s.messageOutbox.attempts,
        lastError: s.messageOutbox.lastError,
        createdAt: s.messageOutbox.createdAt,
        acceptedAt: s.messageOutbox.acceptedAt,
        deliveredAt: s.messageOutbox.deliveredAt,
        requestId: s.messageOutbox.requestId,
      })
      .from(s.messageOutbox)
      .orderBy(s.messageOutbox.id)
      .limit(200);
    const runs = await db
      .select()
      .from(s.automationRuns)
      .orderBy(s.automationRuns.id)
      .limit(30);
    return {
      settings: {
        remindersEnabled: p.remindersEnabled,
        reminderHours: p.reminderHours,
        proposalReminderHours: p.proposalReminderHours,
        emailEnabled: p.emailEnabled,
        smsEnabled: p.smsEnabled,
        publicOrigin: p.publicOrigin,
        emailFrom: p.emailFrom,
        smsFrom: p.smsFrom,
      },
      providers: providerReadiness(),
      autonomous: {
        enabled: task?.enabled || false,
        lastRunAt: task?.lastRunAt || null,
        registered: !!task?.taskUid,
      },
      outbox: outbox.reverse(),
      runs: runs.reverse(),
    };
  }),
  save: artisan.input(configuration).mutation(async ({ input, ctx }) => {
    const ready = providerReadiness();
    if (
      (input.emailEnabled || input.smsEnabled) &&
      !safeOrigin(input.publicOrigin)
    )
      fail(
        "Configurez l’adresse HTTPS publique de MDS pour les liens de suivi."
      );
    if (input.emailEnabled && (!ready.email || !input.emailFrom))
      fail(
        "Le compte Resend et l’expéditeur vérifié doivent être configurés avant activation."
      );
    if (input.smsEnabled && (!ready.sms || !input.smsFrom))
      fail(
        "Le compte Twilio et l’expéditeur doivent être configurés avant activation."
      );
    const db = await dbRequired();
    return db.transaction(async tx => {
      const p = await principal(tx, true);
      if (input.proposalReminderHours >= p.proposalExpiryHours)
        fail("Le rappel doit précéder la durée d’expiration des propositions.");
      await tx.update(s.settings).set(input).where(eq(s.settings.id, 1));
      await recordAudit(
        tx,
        ctx.user.id,
        "automation.settings.save",
        "settings",
        1
      );
      return { success: true as const };
    });
  }),
  run: artisan
    .input(z.object({ confirmed: z.literal(true) }))
    .mutation(async ({ ctx }) =>
      runAutomation(await dbRequired(), "manual", null, ctx.user.id)
    ),
  sync: artisan
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      const [row] = await db
        .select()
        .from(s.messageOutbox)
        .where(eq(s.messageOutbox.id, input.id));
      if (!row || row.status !== "accepted" || !row.providerId)
        fail("Ce message n’attend pas de preuve fournisseur.", "CONFLICT");
      try {
        const status = await retrieveMessageStatus(row);
        await db
          .update(s.messageOutbox)
          .set({
            status: status.status,
            deliveredAt: status.status === "delivered" ? new Date() : null,
            lastError: status.note,
          })
          .where(
            and(
              eq(s.messageOutbox.id, row.id),
              eq(s.messageOutbox.status, "accepted")
            )
          );
        await recordAudit(
          db,
          ctx.user.id,
          "notification.providerStatus.sync",
          "message",
          row.id
        );
        return { success: true as const };
      } catch {
        fail(
          "Le fournisseur n’a pas fourni de statut vérifiable. Le dernier état confirmé est conservé.",
          "CONFLICT"
        );
      }
    }),
  retry: artisan
    .input(
      z.object({
        id: z.number().int().positive(),
        confirmedNotSent: z.literal(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        const [row] = await tx
          .select()
          .from(s.messageOutbox)
          .where(eq(s.messageOutbox.id, input.id))
          .for("update");
        if (!row || !["failed", "disabled", "uncertain"].includes(row.status))
          fail("Ce message ne peut pas être repris.", "CONFLICT");
        const p = await principal(tx);
        const ready = providerReadiness();
        if (
          row.channel === "email"
            ? !p.emailEnabled || !ready.email
            : !p.smsEnabled || !ready.sms
        )
          fail("Configurez et activez ce canal avant la reprise.");
        await tx
          .update(s.messageOutbox)
          .set({
            status: "queued",
            nextAttemptAt: null,
            lastError: null,
            leaseUntil: null,
          })
          .where(eq(s.messageOutbox.id, row.id));
        await recordAudit(
          tx,
          ctx.user.id,
          "notification.retry.confirmedNotSent",
          "message",
          row.id
        );
        return { success: true as const };
      });
    }),
});
export function registerAutomationRoutes(app: Express) {
  app.post("/api/scheduled/mds-maintenance", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    let taskUid: string;
    try {
      taskUid = await scheduledIdentity(req);
    } catch {
      return res
        .status(401)
        .json({ error: "Identité planifiée non vérifiée." });
    }
    try {
      const result = await runAutomation(
        await dbRequired(),
        "scheduled",
        taskUid,
        null
      );
      return res.json(result);
    } catch {
      return res.status(500).json({
        error:
          "Le traitement MDS n’a pas abouti. Vérifiez l’activation de la tâche et le journal.",
      });
    }
  });
}
