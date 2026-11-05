import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import { storageGetSignedUrl, storagePut } from "../storage";
import * as s from "../../drizzle/schema";
import {
  authorizeRequest,
  dbRequired,
  event,
  membership,
  principal,
  procedure,
  recordAudit,
  requireArtisan,
  secureEqual,
  hash,
  type Identity,
  type SqlDb,
} from "./common";
import {
  allowedMime,
  decryptFile,
  encryptFile,
  MAX_FILE_BYTES,
  validateFile,
} from "./files";
import { fail } from "./workflow";
const reference = z.string().min(4).max(40).optional();
const token = z.string().min(16).max(100).optional();
const kind = z.enum(["photo", "quote", "invoice", "contract", "other"]);
const photoStage = z.enum(["before", "after", "other"]).default("other");
async function documentScope(
  db: SqlDb,
  input: {
    reference?: string;
    token?: string;
    organizationId?: number;
    kind: string;
    photoStage?: "before" | "after" | "other";
  },
  user: Identity,
  upload: boolean
) {
  let request: s.MdsRequest | undefined;
  if (input.reference) {
    [request] = await db
      .select()
      .from(s.requests)
      .where(eq(s.requests.reference, input.reference));
    if (!request)
      fail("La demande liée au document est introuvable.", "NOT_FOUND");
    await authorizeRequest(db, request, user, input.token);
    if (input.organizationId && request.organizationId !== input.organizationId)
      fail(
        "Le document et la demande doivent appartenir à la même organisation.",
        "FORBIDDEN"
      );
  }
  const organizationId =
    request?.organizationId || input.organizationId || null;
  if (input.organizationId)
    await membership(db, input.organizationId, user, input.kind === "contract");
  if (!request && !organizationId)
    fail("Rattachez le document à une demande ou une organisation autorisée.");
  if (!user || user.id <= 0) {
    if (
      !upload ||
      input.kind !== "photo" ||
      !request ||
      !input.token ||
      !secureEqual(hash(input.token), request.trackingHash)
    )
      fail(
        "Sans compte, seules les photos de votre propre demande sont autorisées.",
        "FORBIDDEN"
      );
    if (["refused", "cancelled", "closed"].includes(request.status))
      fail("Ce dossier n’accepte plus de nouvelles photos.", "CONFLICT");
  }
  if (upload && ["quote", "invoice"].includes(input.kind))
    await requireArtisan(db, user);
  if (input.kind !== "photo" && (input.photoStage || "other") !== "other")
    fail("La séquence avant/après concerne uniquement les photos.");
  if (upload && input.kind === "photo" && input.photoStage === "after")
    await requireArtisan(db, user);
  if (upload && input.kind === "contract") {
    if (!organizationId)
      fail("Un contrat doit être rattaché à une organisation.");
    await membership(db, organizationId, user, true);
  }
  return { request, organizationId };
}
async function limitedBytes(response: Response, maximum: number) {
  if (!response.body)
    fail("Le fichier stocké ne peut pas être récupéré.", "CONFLICT");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maximum) {
      await reader.cancel();
      fail(
        "Le fichier stocké ne correspond pas à son index sécurisé.",
        "CONFLICT"
      );
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
export const documentsRouter = router({
  upload: procedure
    .input(
      z.object({
        reference,
        token,
        organizationId: z.number().int().positive().optional(),
        name: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine(v => !/[\x00-\x1f\/\\]/.test(v), "Nom de fichier invalide"),
        mimeType: z
          .string()
          .max(100)
          .refine(
            v => allowedMime.includes(v as (typeof allowedMime)[number]),
            "Format non accepté"
          ),
        base64: z.string().max(Math.ceil(MAX_FILE_BYTES / 3) * 4),
        kind,
        photoStage,
        description: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      // Authorization precedes decoding/encryption and any object-store transfer.
      await documentScope(db, input, ctx.user, true);
      const plaintext = validateFile(input.base64, input.mimeType, input.kind);
      const encrypted = encryptFile(plaintext);
      return db.transaction(async tx => {
        const p = await principal(tx, true);
        const scope = await documentScope(tx, input, ctx.user, true);
        const stored = await storagePut(
          `mds/private/${randomBytes(24).toString("hex")}.bin`,
          encrypted.ciphertext,
          "application/octet-stream"
        );
        const [created] = await tx
          .insert(s.documents)
          .values({
            requestId: scope.request?.id || null,
            organizationId: scope.organizationId,
            uploadedBy: ctx.user && ctx.user.id > 0 ? ctx.user.id : null,
            name: input.name,
            mimeType: input.mimeType,
            kind: input.kind,
            photoStage: input.photoStage,
            photoAuthor:
              input.kind === "photo"
                ? ctx.user?.id === p.artisanUserId
                  ? "artisan"
                  : "client"
                : "other",
            description:
              input.kind === "photo" ? input.description || null : null,
            byteSize: plaintext.length,
            storageKey: stored.key,
            encryptionKey: encrypted.encryptionKey,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
          })
          .$returningId();
        if (input.kind === "contract" && scope.organizationId)
          await tx.insert(s.contracts).values({
            organizationId: scope.organizationId,
            documentId: created.id,
            name: input.name,
            status: "indexed",
          });
        const actorId = ctx.user && ctx.user.id > 0 ? ctx.user.id : null;
        await recordAudit(
          tx,
          actorId,
          "document.upload",
          "document",
          created.id
        );
        if (scope.request)
          await event(
            tx,
            scope.request,
            scope.request.status,
            `Document privé ajouté : ${input.name}.`,
            ctx.user?.id === p.artisanUserId ? "artisan" : "client",
            actorId
          );
        else {
          await tx.insert(s.notifications).values({
            organizationId: scope.organizationId,
            audience: "client",
            title: "Document privé ajouté",
            message: `Le document « ${input.name} » a été ajouté à votre organisation.`,
          });
          await tx.insert(s.notifications).values({
            userId: p.artisanUserId,
            organizationId: scope.organizationId,
            audience: "artisan",
            title: "Document professionnel ajouté",
            message: `Le document « ${input.name} » est indexé dans l’organisation.`,
          });
        }
        return created;
      });
    }),
  download: procedure
    .input(z.object({ id: z.number().int().positive(), reference, token }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      const document = await db.transaction(async tx => {
        await principal(tx, true);
        const [doc] = await tx
          .select()
          .from(s.documents)
          .where(eq(s.documents.id, input.id));
        if (!doc) fail("Ce document est introuvable.", "NOT_FOUND");
        if (doc.requestId) {
          const [request] = await tx
            .select()
            .from(s.requests)
            .where(eq(s.requests.id, doc.requestId));
          if (!request)
            fail("Le dossier lié au document est introuvable.", "NOT_FOUND");
          if (input.reference && request.reference !== input.reference)
            fail(
              "Ce document n’appartient pas à la demande indiquée.",
              "FORBIDDEN"
            );
          if (input.token && !input.reference)
            fail(
              "Le lien de suivi complet est nécessaire pour ce document.",
              "FORBIDDEN"
            );
          await authorizeRequest(tx, request, ctx.user, input.token);
          const p = await principal(tx);
          if (
            !(ctx.user?.role === "admin" && ctx.user.id === p.artisanUserId)
          ) {
            const [draft] = await tx
              .select()
              .from(s.quoteDrafts)
              .where(eq(s.quoteDrafts.documentId, doc.id));
            if (draft && draft.status !== "issued")
              fail(
                "Ce devis n’a pas encore été transmis par MDS.",
                "FORBIDDEN"
              );
          }
        } else if (doc.organizationId)
          await membership(tx, doc.organizationId, ctx.user);
        else fail("Ce document n’est pas accessible.", "FORBIDDEN");
        // Metadata is returned only within server code, never as a tRPC response.
        return doc;
      });
      const url = await storageGetSignedUrl(document.storageKey);
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok)
        fail("Le document stocké est momentanément indisponible.", "CONFLICT");
      const ciphertext = await limitedBytes(response, document.byteSize);
      if (ciphertext.length !== document.byteSize)
        fail(
          "L’intégrité du fichier stocké ne peut pas être vérifiée.",
          "CONFLICT"
        );
      let plaintext: Buffer;
      try {
        plaintext = decryptFile(ciphertext, document);
      } catch {
        fail(
          "L’intégrité cryptographique du document ne peut pas être vérifiée.",
          "CONFLICT"
        );
      }
      await recordAudit(
        db,
        ctx.user && ctx.user.id > 0 ? ctx.user.id : null,
        "document.download",
        "document",
        document.id
      );
      ctx.res.set("Cache-Control", "private, no-store");
      return {
        base64: plaintext.toString("base64"),
        name: document.name,
        mimeType: document.mimeType,
      };
    }),
});
