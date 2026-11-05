import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import { incidentSchema, extraWorkSchema } from "../../shared/operations";
import { trackSchema, money } from "../../shared/mds";
import { MAX_CENTS } from "../../shared/pricing";
import {
  artisan,
  authorizeRequest,
  dbRequired,
  event,
  principal,
  procedure,
  recordAudit,
  type Tx,
  type Identity,
} from "./common";
import { checkVersion, fail, requireState } from "./workflow";

export async function operationPrincipal(tx: Tx, actorId: number) {
  const p = await principal(tx, true);
  if (p.artisanUserId !== actorId)
    fail("Cet accès est réservé à l’artisan MDS.", "FORBIDDEN");
  return p;
}
export const blockingIncidentKinds = [
  "problem",
  "client_absent",
  "artisan_unavailable",
] as const;
export async function loadOperationRequest(tx: Tx, id: number) {
  const [r] = await tx
    .select()
    .from(s.requests)
    .where(eq(s.requests.id, id))
    .for("update");
  if (!r) fail("Cette demande est introuvable.", "NOT_FOUND");
  return r;
}
export async function assertNoOperationalBlock(tx: Tx, r: s.MdsRequest) {
  const [block] = await tx
    .select()
    .from(s.incidents)
    .where(
      and(
        eq(s.incidents.requestId, r.id),
        eq(s.incidents.status, "open"),
        inArray(s.incidents.kind, [...blockingIncidentKinds])
      )
    )
    .limit(1);
  if (block)
    fail(
      "Un incident bloquant reste ouvert. Enregistrez sa résolution avant de démarrer ou terminer les travaux.",
      "CONFLICT"
    );
}
export async function assertExtrasClosed(tx: Tx, requestId: number) {
  const [extra] = await tx
    .select()
    .from(s.extraWorks)
    .where(
      and(
        eq(s.extraWorks.requestId, requestId),
        inArray(s.extraWorks.status, ["pending", "accepted", "in_progress"])
      )
    )
    .limit(1);
  if (extra)
    fail(
      "Clôturez les suppléments : refusez ou annulez ceux non réalisés, puis terminez ceux effectivement exécutés avant de terminer l’intervention.",
      "CONFLICT"
    );
}
export async function invoiceTotalCents(tx: Tx, r: s.MdsRequest) {
  if (
    r.proposedPriceCents == null ||
    !Number.isSafeInteger(r.proposedPriceCents) ||
    r.proposedPriceCents < 0
  )
    fail("Un prix contractuel réel est obligatoire.", "CONFLICT");
  const extras = await tx
    .select()
    .from(s.extraWorks)
    .where(
      and(
        eq(s.extraWorks.requestId, r.id),
        eq(s.extraWorks.status, "completed")
      )
    );
  let total = r.proposedPriceCents;
  for (const extra of extras) {
    if (
      !extra.acceptedAt ||
      !extra.startedAt ||
      !extra.completedAt ||
      !Number.isSafeInteger(extra.amountCents) ||
      extra.amountCents < 0
    )
      fail(
        "Un supplément terminé n’a pas de preuve d’accord et d’exécution cohérente.",
        "CONFLICT"
      );
    total += extra.amountCents;
  }
  if (!Number.isSafeInteger(total) || total > MAX_CENTS)
    fail("Le montant total dépasse la limite autorisée.");
  return total;
}
export async function cancelUnstartedExtras(tx: Tx, r: s.MdsRequest) {
  const extras = await tx
    .select()
    .from(s.extraWorks)
    .where(
      and(
        eq(s.extraWorks.requestId, r.id),
        inArray(s.extraWorks.status, ["pending", "accepted"])
      )
    );
  for (const extra of extras)
    await tx
      .update(s.extraWorks)
      .set({ status: "cancelled", version: extra.version + 1, expiresAt: null })
      .where(eq(s.extraWorks.id, extra.id));
}
export async function bumpOperationRequest(
  tx: Tx,
  r: s.MdsRequest,
  action: string
) {
  const [changed] = await tx
    .update(s.requests)
    .set({
      version: r.version + 1,
      lastAction: action,
      lastActionVersion: r.version,
    })
    .where(and(eq(s.requests.id, r.id), eq(s.requests.version, r.version)));
  if (changed.affectedRows !== 1)
    fail("Le dossier a changé. Actualisez-le avant de continuer.", "CONFLICT");
}
async function clientRequest(
  tx: Tx,
  input: z.infer<typeof trackSchema>,
  user: Identity
) {
  const p = await principal(tx, true);
  const [r] = await tx
    .select()
    .from(s.requests)
    .where(eq(s.requests.reference, input.reference))
    .for("update");
  if (!r) fail("Cette demande est introuvable.", "NOT_FOUND");
  await authorizeRequest(tx, r, user, input.token);
  if (user?.id === p.artisanUserId)
    fail(
      "L’accord ou la réclamation client ne peut pas être enregistré par l’artisan.",
      "FORBIDDEN"
    );
  return r;
}
async function extraById(tx: Tx, id: number) {
  const [extra] = await tx
    .select()
    .from(s.extraWorks)
    .where(eq(s.extraWorks.id, id))
    .for("update");
  if (!extra) fail("Ce supplément est introuvable.", "NOT_FOUND");
  return extra;
}
export async function expireExtra(
  tx: Tx,
  r: s.MdsRequest,
  extra: typeof s.extraWorks.$inferSelect,
  now = new Date()
) {
  if (extra.status !== "pending" || !extra.expiresAt || extra.expiresAt > now)
    return false;
  await tx
    .update(s.extraWorks)
    .set({ status: "refused", version: extra.version + 1, expiresAt: null })
    .where(
      and(
        eq(s.extraWorks.id, extra.id),
        eq(s.extraWorks.version, extra.version)
      )
    );
  await bumpOperationRequest(tx, r, "extra:expire");
  await event(
    tx,
    r,
    r.status,
    `Supplément n° ${extra.id} expiré sans accord client. Aucune exécution ni facturation autorisée.`,
    "system",
    null
  );
  await recordAudit(tx, null, "extra.expire", "extraWork", extra.id);
  return true;
}
const extraIdentity = z.object({
  id: z.number().int().positive(),
  version: z.number().int().min(0),
});
export const operationsRouter = router({
  report: artisan.input(incidentSchema).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    return db.transaction(async tx => {
      await operationPrincipal(tx, ctx.user.id);
      const r = await loadOperationRequest(tx, input.requestId);
      checkVersion(r, input.version);
      const [created] = await tx
        .insert(s.incidents)
        .values({
          requestId: r.id,
          kind: input.kind,
          message: input.message,
          actorType: "artisan",
          reportedBy: ctx.user.id,
          status: "open",
        })
        .$returningId();
      await bumpOperationRequest(tx, r, "incident:report");
      const blocking = blockingIncidentKinds.some(kind => kind === input.kind);
      await event(
        tx,
        r,
        r.status,
        `Incident signalé (${input.kind})${blocking ? " — démarrage/fin suspendus jusqu’à résolution" : " — informatif, sans changement d’état"} : ${input.message}`,
        "artisan",
        ctx.user.id
      );
      await recordAudit(
        tx,
        ctx.user.id,
        "incident.report",
        "incident",
        created.id
      );
      return created;
    });
  }),
  complaint: procedure
    .input(
      trackSchema.extend({
        version: z.number().int().min(0),
        message: z.string().trim().min(5).max(3000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        const r = await clientRequest(tx, input, ctx.user);
        checkVersion(r, input.version);
        const actor = ctx.user?.id || null;
        const [created] = await tx
          .insert(s.incidents)
          .values({
            requestId: r.id,
            kind: "complaint",
            message: input.message,
            actorType: "client",
            reportedBy: actor,
            status: "open",
          })
          .$returningId();
        await bumpOperationRequest(tx, r, "incident:complaint");
        await event(
          tx,
          r,
          r.status,
          `Réclamation client enregistrée, sans changement de progression : ${input.message}`,
          "client",
          actor
        );
        await recordAudit(
          tx,
          actor,
          "incident.complaint",
          "incident",
          created.id
        );
        return created;
      });
    }),
  resolve: artisan
    .input(
      z.object({
        id: z.number().int().positive(),
        requestVersion: z.number().int().min(0),
        resolution: z.string().trim().min(5).max(3000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await operationPrincipal(tx, ctx.user.id);
        const [incident] = await tx
          .select()
          .from(s.incidents)
          .where(eq(s.incidents.id, input.id))
          .for("update");
        if (!incident) fail("Cet incident est introuvable.", "NOT_FOUND");
        const r = await loadOperationRequest(tx, incident.requestId);
        checkVersion(r, input.requestVersion);
        if (incident.status !== "open")
          fail("Cet incident est déjà résolu.", "CONFLICT");
        await tx
          .update(s.incidents)
          .set({
            status: "resolved",
            resolution: input.resolution,
            resolvedBy: ctx.user.id,
            resolvedAt: new Date(),
          })
          .where(eq(s.incidents.id, incident.id));
        await bumpOperationRequest(tx, r, "incident:resolve");
        await event(
          tx,
          r,
          r.status,
          `Incident n° ${incident.id} résolu manuellement : ${input.resolution}. Aucun changement automatique d’état.`,
          "artisan",
          ctx.user.id
        );
        await recordAudit(
          tx,
          ctx.user.id,
          "incident.resolve",
          "incident",
          incident.id
        );
        return { success: true as const };
      });
    }),
  proposeExtra: artisan
    .input(extraWorkSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        const p = await operationPrincipal(tx, ctx.user.id);
        const r = await loadOperationRequest(tx, input.requestId);
        checkVersion(r, input.version);
        requireState(r, ["planned", "en_route", "in_progress"]);
        const existing = await tx
          .select()
          .from(s.extraWorks)
          .where(
            and(
              eq(s.extraWorks.requestId, r.id),
              inArray(s.extraWorks.status, [
                "pending",
                "accepted",
                "in_progress",
                "completed",
              ])
            )
          );
        const exposure =
          (r.proposedPriceCents || 0) +
          existing.reduce((sum, row) => sum + row.amountCents, 0) +
          input.amountCents;
        if (!Number.isSafeInteger(exposure) || exposure > MAX_CENTS)
          fail("Le total des travaux dépasse la limite autorisée.");
        if (input.documentId) {
          const [doc] = await tx
            .select()
            .from(s.documents)
            .where(
              and(
                eq(s.documents.id, input.documentId),
                eq(s.documents.requestId, r.id)
              )
            );
          if (!doc)
            fail(
              "Le document doit appartenir à ce dossier autorisé.",
              "FORBIDDEN"
            );
        }
        const { requestId, version, ...scope } = input;
        const [created] = await tx
          .insert(s.extraWorks)
          .values({
            ...scope,
            requestId: r.id,
            status: "pending",
            version: 0,
            expiresAt: new Date(Date.now() + p.proposalExpiryHours * 3600000),
          })
          .$returningId();
        await bumpOperationRequest(tx, r, "extra:propose");
        await event(
          tx,
          r,
          r.status,
          `Supplément n° ${created.id} proposé : ${input.scope} — ${money(input.amountCents)}, ${input.durationMinutes} min. Conditions : ${input.conditions}. Accord client obligatoire avant exécution ; le prix principal ne change pas.`,
          "artisan",
          ctx.user.id
        );
        await recordAudit(
          tx,
          ctx.user.id,
          "extra.propose",
          "extraWork",
          created.id
        );
        return created;
      });
    }),
  respondExtra: procedure
    .input(
      trackSchema.extend({
        id: z.number().int().positive(),
        version: z.number().int().min(0),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      const result = await db.transaction(async tx => {
        const r = await clientRequest(tx, input, ctx.user);
        const extra = await extraById(tx, input.id);
        if (extra.requestId !== r.id)
          fail("Ce supplément n’appartient pas à votre demande.", "FORBIDDEN");
        if (await expireExtra(tx, r, extra)) return { expired: true };
        checkVersion(extra, input.version);
        requireState(r, ["planned", "en_route", "in_progress"]);
        if (extra.status !== "pending")
          fail("Ce supplément n’attend plus de réponse.", "CONFLICT");
        const actor = ctx.user?.id || null;
        await tx
          .update(s.extraWorks)
          .set({
            status: input.accept ? "accepted" : "refused",
            version: extra.version + 1,
            expiresAt: null,
            acceptedAt: input.accept ? new Date() : null,
            acceptedBy: input.accept ? actor : null,
          })
          .where(
            and(
              eq(s.extraWorks.id, extra.id),
              eq(s.extraWorks.version, extra.version)
            )
          );
        await bumpOperationRequest(tx, r, "extra:respond");
        await event(
          tx,
          r,
          r.status,
          `Le client a ${input.accept ? "accepté" : "refusé"} le supplément n° ${extra.id} : ${extra.scope} — ${money(extra.amountCents)}. ${input.accept ? "L’exécution doit encore être déclarée par MDS." : "Aucune exécution ni facturation autorisée."}`,
          "client",
          actor
        );
        await recordAudit(
          tx,
          actor,
          input.accept ? "extra.accept" : "extra.refuse",
          "extraWork",
          extra.id
        );
        return { expired: false };
      });
      if (result.expired)
        fail(
          "Ce supplément a expiré sans accord et le refus a été enregistré.",
          "CONFLICT"
        );
      return { success: true as const };
    }),
  startExtra: artisan
    .input(extraIdentity)
    .mutation(({ input, ctx }) => executeExtra(input, ctx.user.id, "start")),
  completeExtra: artisan
    .input(extraIdentity)
    .mutation(({ input, ctx }) => executeExtra(input, ctx.user.id, "complete")),
  cancelExtra: artisan
    .input(extraIdentity)
    .mutation(({ input, ctx }) => executeExtra(input, ctx.user.id, "cancel")),
});
async function executeExtra(
  input: z.infer<typeof extraIdentity>,
  actor: number,
  action: "start" | "complete" | "cancel"
) {
  const db = await dbRequired();
  return db.transaction(async tx => {
    await operationPrincipal(tx, actor);
    const extra = await extraById(tx, input.id);
    checkVersion(extra, input.version);
    const r = await loadOperationRequest(tx, extra.requestId);
    if (action === "cancel") {
      if (!["pending", "accepted"].includes(extra.status) || extra.startedAt)
        fail("Seul un supplément non commencé peut être annulé.", "CONFLICT");
    } else {
      requireState(r, ["in_progress"]);
      await assertNoOperationalBlock(tx, r);
      const [intervention] = await tx
        .select()
        .from(s.interventions)
        .where(eq(s.interventions.requestId, r.id));
      if (!intervention?.startedAt || intervention.completedAt)
        fail(
          "L’intervention principale doit avoir réellement commencé.",
          "CONFLICT"
        );
      if (
        !extra.acceptedAt ||
        extra.status !== (action === "start" ? "accepted" : "in_progress")
      )
        fail(
          "L’accord client et l’état d’exécution du supplément sont obligatoires.",
          "CONFLICT"
        );
      if (action === "complete" && !extra.startedAt)
        fail("Le démarrage réel du supplément est obligatoire.", "CONFLICT");
    }
    await tx
      .update(s.extraWorks)
      .set({
        status:
          action === "start"
            ? "in_progress"
            : action === "complete"
              ? "completed"
              : "cancelled",
        version: extra.version + 1,
        expiresAt: null,
        ...(action === "start"
          ? { startedAt: new Date() }
          : action === "complete"
            ? { completedAt: new Date() }
            : {}),
      })
      .where(
        and(
          eq(s.extraWorks.id, extra.id),
          eq(s.extraWorks.version, extra.version)
        )
      );
    await bumpOperationRequest(tx, r, `extra:${action}`);
    await event(
      tx,
      r,
      r.status,
      `Supplément n° ${extra.id} ${action === "start" ? "réellement démarré après accord client" : action === "complete" ? "déclaré terminé ; facturable selon l’accord client" : "annulé avant exécution ; non facturable"}. La progression principale reste inchangée.`,
      "artisan",
      actor
    );
    await recordAudit(tx, actor, `extra.${action}`, "extraWork", extra.id);
    return { success: true as const };
  });
}
