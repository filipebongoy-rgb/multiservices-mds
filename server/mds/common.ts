import { enqueueEventMessages } from "./outbox";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import * as s from "../../drizzle/schema";
import { fail } from "./workflow";
import { statusLabels, type RequestStatus } from "../../shared/mds";

export type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type SqlDb = Pick<
  Database,
  "select" | "insert" | "update" | "delete" | "execute"
>;
export type Identity = s.User | null;
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function secretHash(value: string, key: string | null) {
  if (!key) fail("La sécurité du suivi n’est pas configurée.");
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update(value)
    .digest("hex");
}
export function secureEqual(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export async function dbRequired() {
  const db = await getDb();
  if (!db)
    fail("La base de données est momentanément indisponible.", "CONFLICT");
  return db;
}
export async function principal(db: SqlDb, lock = false) {
  const query = db.select().from(s.settings).where(eq(s.settings.id, 1));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) fail("L’initialisation MDS doit être terminée.", "CONFLICT");
  return row;
}
export async function requireArtisan(db: SqlDb, user: Identity) {
  if (!user || user.id <= 0)
    fail("Connectez-vous pour accéder à l’espace artisan.", "UNAUTHORIZED");
  const p = await principal(db);
  if (user.role !== "admin" || p.artisanUserId !== user.id)
    fail("Cet accès est réservé à l’artisan MDS.", "FORBIDDEN");
}
// This middleware also replaces opaque English validation/database errors for MDS APIs.
export const procedure = publicProcedure.use(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    if (result.error.code === "BAD_REQUEST")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.error.cause
          ? "Vérifiez les champs saisis : leur format ou leur taille est invalide."
          : result.error.message,
      });
    if (result.error.code === "INTERNAL_SERVER_ERROR")
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "L’opération n’a pas abouti. Réessayez ou contactez MDS.",
      });
  }
  return result;
});
export const authenticated = procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.id <= 0)
    fail("Connectez-vous pour continuer.", "UNAUTHORIZED");
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const artisan = authenticated.use(async ({ ctx, next }) => {
  await requireArtisan(await dbRequired(), ctx.user);
  return next();
});
export async function membership(
  db: SqlDb,
  organizationId: number,
  user: Identity,
  manage = false
) {
  if (!user || user.id <= 0)
    fail("Connectez-vous pour accéder à cette organisation.", "UNAUTHORIZED");
  // Artisan can inspect/manage customer records, but this never adds them as a collaborator.
  const p = await principal(db);
  if (user.role === "admin" && p.artisanUserId === user.id)
    return { role: "artisan" as const };
  const [member] = await db
    .select()
    .from(s.members)
    .where(
      and(
        eq(s.members.organizationId, organizationId),
        eq(s.members.userId, user.id)
      )
    );
  if (!member || (manage && member.role === "member"))
    fail(
      "Vous n’êtes pas autorisé à accéder à cette organisation.",
      "FORBIDDEN"
    );
  return member;
}
export async function orgIds(db: SqlDb, userId: number) {
  return (
    await db
      .select({ id: s.members.organizationId })
      .from(s.members)
      .where(eq(s.members.userId, userId))
  ).map(r => r.id);
}
export async function requestFilter(db: SqlDb, user: s.User) {
  const p = await principal(db);
  if (user.role === "admin" && p.artisanUserId === user.id) return sql`true`;
  const ids = await orgIds(db, user.id);
  return or(
    and(isNull(s.requests.organizationId), eq(s.requests.userId, user.id)),
    ids.length ? inArray(s.requests.organizationId, ids) : sql`false`
  )!;
}
export async function authorizeRequest(
  db: SqlDb,
  request: s.MdsRequest,
  user: Identity,
  token?: string
) {
  // Organization permissions are live membership, never a historic author or guest capability.
  if (request.organizationId) {
    await membership(db, request.organizationId, user);
    return;
  }
  if (token && secureEqual(hash(token), request.trackingHash)) return;
  if (!user || user.id <= 0)
    fail(
      "Le lien de suivi est invalide ou une connexion est nécessaire.",
      "FORBIDDEN"
    );
  const p = await principal(db);
  if (
    (user.role === "admin" && p.artisanUserId === user.id) ||
    request.userId === user.id
  )
    return;
  fail("Vous n’êtes pas autorisé à consulter ce dossier.", "FORBIDDEN");
}
export function publicRequest(row: s.MdsRequest) {
  const {
    trackingHash,
    idempotencyHash,
    payloadHash,
    userId,
    clientId,
    consentAt,
    lastAction,
    lastActionVersion,
    ...safe
  } = row;
  return safe;
}
export const documentFields = {
  id: s.documents.id,
  name: s.documents.name,
  mimeType: s.documents.mimeType,
  kind: s.documents.kind,
  photoStage: s.documents.photoStage,
  photoAuthor: s.documents.photoAuthor,
  description: s.documents.description,
  createdAt: s.documents.createdAt,
};
export async function recordAudit(
  db: SqlDb,
  actorUserId: number | null,
  action: string,
  entityType: string,
  entityId: number | null
) {
  await db
    .insert(s.audit)
    .values({ actorUserId, action, entityType, entityId });
}
export async function event(
  db: SqlDb,
  request: s.MdsRequest,
  status: RequestStatus,
  message: string,
  actorType: "client" | "artisan" | "system",
  actorUserId: number | null
) {
  const [createdEvent] = await db
    .insert(s.events)
    .values({ requestId: request.id, status, message, actorType, actorUserId })
    .$returningId();
  const p = await principal(db);
  await db.insert(s.notifications).values({
    requestId: request.id,
    userId: p.artisanUserId,
    audience: "artisan",
    title: `${request.reference} — ${statusLabels[status]}`,
    message,
  });
  await db.insert(s.notifications).values({
    requestId: request.id,
    userId: request.userId,
    organizationId: request.organizationId,
    audience: "client",
    title: statusLabels[status],
    message,
  });
  await enqueueEventMessages(
    db,
    request,
    p,
    createdEvent.id,
    status,
    message,
    actorType
  );
}
export async function detailData(
  db: SqlDb,
  request: s.MdsRequest,
  authenticatedUser: boolean,
  artisanView = false
) {
  const history = await db
    .select({
      id: s.events.id,
      requestId: s.events.requestId,
      status: s.events.status,
      message: s.events.message,
      actorType: s.events.actorType,
      createdAt: s.events.createdAt,
    })
    .from(s.events)
    .where(eq(s.events.requestId, request.id))
    .orderBy(s.events.id);
  let docs = await db
    .select(documentFields)
    .from(s.documents)
    .where(eq(s.documents.requestId, request.id))
    .orderBy(s.documents.id);
  if (!artisanView) {
    const drafts = await db
      .select({ documentId: s.quoteDrafts.documentId })
      .from(s.quoteDrafts)
      .where(
        and(
          eq(s.quoteDrafts.requestId, request.id),
          inArray(s.quoteDrafts.status, ["draft", "generated"])
        )
      );
    const hidden = new Set(drafts.map(r => r.documentId));
    docs = docs.filter(d => !hidden.has(d.id));
  }
  const [appointment] = await db
    .select({
      id: s.appointments.id,
      startAt: s.appointments.startAt,
      endAt: s.appointments.endAt,
      status: s.appointments.status,
    })
    .from(s.appointments)
    .where(eq(s.appointments.requestId, request.id));
  const [intervention] = await db
    .select({
      startedAt: s.interventions.startedAt,
      arrivedAt: s.interventions.arrivedAt,
      completedAt: s.interventions.completedAt,
      summary: s.interventions.summary,
      clientConfirmedAt: s.interventions.clientConfirmedAt,
      clientConfirmationMessage: s.interventions.clientConfirmationMessage,
    })
    .from(s.interventions)
    .where(eq(s.interventions.requestId, request.id));
  const reviews = authenticatedUser
    ? await db
        .select({
          id: s.reviews.id,
          authorType: s.reviews.authorType,
          rating: s.reviews.rating,
          comment: s.reviews.comment,
          moderation: s.reviews.moderation,
          createdAt: s.reviews.createdAt,
        })
        .from(s.reviews)
        .where(eq(s.reviews.requestId, request.id))
    : [];
  const [invoice] = await db
    .select({
      id: s.invoices.id,
      amountCents: s.invoices.amountCents,
      currency: s.invoices.currency,
      issuedAt: s.invoices.issuedAt,
      paidAt: s.invoices.paidAt,
    })
    .from(s.invoices)
    .where(eq(s.invoices.requestId, request.id));
  const incidentRows = await db
    .select({
      id: s.incidents.id,
      kind: s.incidents.kind,
      message: s.incidents.message,
      status: s.incidents.status,
      resolution: s.incidents.resolution,
      resolvedAt: s.incidents.resolvedAt,
      createdAt: s.incidents.createdAt,
    })
    .from(s.incidents)
    .where(eq(s.incidents.requestId, request.id))
    .orderBy(s.incidents.id);
  const extras = await db
    .select({
      id: s.extraWorks.id,
      scope: s.extraWorks.scope,
      amountCents: s.extraWorks.amountCents,
      durationMinutes: s.extraWorks.durationMinutes,
      conditions: s.extraWorks.conditions,
      documentId: s.extraWorks.documentId,
      status: s.extraWorks.status,
      version: s.extraWorks.version,
      expiresAt: s.extraWorks.expiresAt,
      acceptedAt: s.extraWorks.acceptedAt,
      startedAt: s.extraWorks.startedAt,
      completedAt: s.extraWorks.completedAt,
      createdAt: s.extraWorks.createdAt,
    })
    .from(s.extraWorks)
    .where(eq(s.extraWorks.requestId, request.id))
    .orderBy(s.extraWorks.id);
  const quoteRows = await db
    .select({
      id: s.quotes.id,
      documentId: s.quotes.documentId,
      status: s.quotes.status,
      content: s.quotes.content,
      amountCents: s.quotes.amountCents,
      issuedAt: s.quotes.issuedAt,
      acceptedAt: s.quotes.acceptedAt,
      createdAt: s.quotes.createdAt,
    })
    .from(s.quotes)
    .where(eq(s.quotes.requestId, request.id))
    .orderBy(s.quotes.id);
  return {
    request: publicRequest(request),
    events: history,
    documents: docs,
    appointment: appointment || null,
    intervention: intervention || null,
    reviews,
    invoice: invoice || null,
    incidents: incidentRows,
    extraWorks: extras,
    quotes: quoteRows,
  };
}
