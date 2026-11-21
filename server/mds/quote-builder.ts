import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import { storagePut } from "../storage";
import * as s from "../../drizzle/schema";
import {
  quoteContentSchema,
  quoteTotals,
  type QuoteContent,
} from "../../shared/operations";
import { artisan, dbRequired, event, recordAudit } from "./common";
import {
  bumpOperationRequest,
  loadOperationRequest,
  operationPrincipal,
} from "./operations";
import { checkVersion, fail, negotiableStates, requireState } from "./workflow";
import { encryptFile, MAX_FILE_BYTES } from "./files";
import { renderQuotePdf } from "./quote-pdf";

export function quoteValidityEnd(validUntil: string) {
  // A quoted date denotes the full Paris civil day, including daylight saving time.
  const date = new Date(`${validUntil}T12:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== validUntil
  )
    fail("La date de validité du devis est invalide.");
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDay = next.toISOString().slice(0, 10);
  const atNoon = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(`${nextDay}T00:00:00Z`))
    .find(part => part.type === "timeZoneName")?.value;
  const offset = atNoon === "GMT+02:00" ? "+02:00" : "+01:00";
  return new Date(`${nextDay}T00:00:00${offset}`);
}
export function validateQuoteContent(content: QuoteContent, now = new Date()) {
  const clean = quoteContentSchema.parse(content);
  const totals = quoteTotals(clean.lines);
  if (clean.depositCents > totals.totalCents)
    fail("L’acompte ne peut pas dépasser le total du devis.");
  if (quoteValidityEnd(clean.validUntil) <= now)
    fail("La validité du devis doit être future.");
  return { content: clean, ...totals };
}
export const quoteBuilderRouter = router({
  list: artisan
    .input(z.object({ requestId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await operationPrincipal(tx, ctx.user.id);
        await loadOperationRequest(tx, input.requestId);
        return tx
          .select()
          .from(s.quoteDrafts)
          .where(eq(s.quoteDrafts.requestId, input.requestId))
          .orderBy(s.quoteDrafts.id);
      });
    }),
  save: artisan
    .input(
      z.object({
        requestId: z.number().int().positive(),
        requestVersion: z.number().int().min(0),
        id: z.number().int().positive().optional(),
        version: z.number().int().min(0).optional(),
        content: quoteContentSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const validated = validateQuoteContent(input.content);
      const db = await dbRequired();
      return db.transaction(async tx => {
        await operationPrincipal(tx, ctx.user.id);
        const r = await loadOperationRequest(tx, input.requestId);
        checkVersion(r, input.requestVersion);
        requireState(r, negotiableStates);
        let id: number;
        if (input.id) {
          const [draft] = await tx
            .select()
            .from(s.quoteDrafts)
            .where(eq(s.quoteDrafts.id, input.id))
            .for("update");
          if (!draft || draft.requestId !== r.id)
            fail("Le brouillon doit appartenir à ce dossier.", "FORBIDDEN");
          if (input.version === undefined)
            fail("La version du brouillon est obligatoire.");
          checkVersion(draft, input.version);
          if (draft.status !== "draft")
            fail(
              "Un PDF généré est immuable. Créez une nouvelle version de devis plutôt que modifier son contenu.",
              "CONFLICT"
            );
          await tx
            .update(s.quoteDrafts)
            .set({
              content: validated.content,
              totalCents: validated.totalCents,
              version: draft.version + 1,
            })
            .where(
              and(
                eq(s.quoteDrafts.id, draft.id),
                eq(s.quoteDrafts.version, draft.version)
              )
            );
          id = draft.id;
        } else {
          if (input.version !== undefined)
            fail("Une version sans identifiant de brouillon est invalide.");
          const [created] = await tx
            .insert(s.quoteDrafts)
            .values({
              requestId: r.id,
              content: validated.content,
              totalCents: validated.totalCents,
              version: 0,
              status: "draft",
              reference: `MDS-D-${new Date().toISOString().slice(0, 10)}-${randomUUID()}`,
            })
            .returning({ id: s.quoteDrafts.id });
          id = created.id;
        }
        await bumpOperationRequest(tx, r, "quote:save");
        await recordAudit(tx, ctx.user.id, "quoteDraft.save", "quoteDraft", id);
        const [draft] = await tx
          .select()
          .from(s.quoteDrafts)
          .where(eq(s.quoteDrafts.id, id));
        return draft;
      });
    }),
  generate: artisan
    .input(
      z.object({
        id: z.number().int().positive(),
        version: z.number().int().min(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await operationPrincipal(tx, ctx.user.id);
        const [draft] = await tx
          .select()
          .from(s.quoteDrafts)
          .where(eq(s.quoteDrafts.id, input.id))
          .for("update");
        if (!draft) fail("Ce brouillon est introuvable.", "NOT_FOUND");
        checkVersion(draft, input.version);
        const r = await loadOperationRequest(tx, draft.requestId);
        requireState(r, negotiableStates);
        if (draft.status !== "draft")
          fail("Ce devis possède déjà un PDF immuable.", "CONFLICT");
        const checked = validateQuoteContent(draft.content);
        if (checked.totalCents !== draft.totalCents)
          fail("Le total du brouillon est incohérent.", "CONFLICT");
        const plaintext = await renderQuotePdf({
          reference: draft.reference,
          createdAt: draft.createdAt,
          content: checked.content,
        });
        if (plaintext.length > MAX_FILE_BYTES)
          fail("Ce devis dépasse la taille maximale de document.");
        const encrypted = encryptFile(plaintext);
        const stored = await storagePut(
          `mds/private/${randomUUID()}.bin`,
          encrypted.ciphertext,
          "application/octet-stream"
        );
        const [document] = await tx
          .insert(s.documents)
          .values({
            requestId: r.id,
            organizationId: r.organizationId,
            uploadedBy: ctx.user.id,
            kind: "quote",
            name: `${draft.reference}.pdf`,
            mimeType: "application/pdf",
            byteSize: plaintext.length,
            storageKey: stored.key,
            encryptionKey: encrypted.encryptionKey,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
          })
          .returning({ id: s.documents.id });
        await tx
          .update(s.quoteDrafts)
          .set({
            status: "generated",
            documentId: document.id,
            version: draft.version + 1,
          })
          .where(
            and(
              eq(s.quoteDrafts.id, draft.id),
              eq(s.quoteDrafts.version, draft.version)
            )
          );
        await bumpOperationRequest(tx, r, "quote:generate");
        await event(
          tx,
          r,
          r.status,
          "Un PDF de devis a été préparé. Il n’est pas encore proposé ni accepté ; aucun rendez-vous n’est réservé.",
          "artisan",
          ctx.user.id
        );
        await recordAudit(
          tx,
          ctx.user.id,
          "quoteDraft.generate",
          "quoteDraft",
          draft.id
        );
        return {
          id: draft.id,
          documentId: document.id,
          version: draft.version + 1,
          totalCents: draft.totalCents,
        };
      });
    }),
});
