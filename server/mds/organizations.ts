import { randomBytes } from "node:crypto";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import {
  authenticated,
  dbRequired,
  documentFields,
  hash,
  membership,
  principal,
  recordAudit,
} from "./common";
import { listScoped } from "./requests";
import { fail } from "./workflow";
const orgId = z.number().int().positive();
const orgType = z.enum([
  "entreprise",
  "syndic",
  "bailleur",
  "gestionnaire",
  "association",
  "collectivite",
]);
const collaboratorRole = z.enum(["manager", "member"]);
export const organizationsRouter = router({
  list: authenticated.query(async ({ ctx }) => {
    const db = await dbRequired();
    return db
      .select({
        id: s.organizations.id,
        name: s.organizations.name,
        type: s.organizations.type,
        role: s.members.role,
      })
      .from(s.members)
      .innerJoin(
        s.organizations,
        eq(s.members.organizationId, s.organizations.id)
      )
      .where(eq(s.members.userId, ctx.user.id));
  }),
  create: authenticated
    .input(z.object({ name: z.string().trim().min(2).max(200), type: orgType }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        const [created] = await tx
          .insert(s.organizations)
          .values({ ...input, ownerUserId: ctx.user.id })
          .$returningId();
        await tx.insert(s.members).values({
          organizationId: created.id,
          userId: ctx.user.id,
          role: "owner",
        });
        await recordAudit(
          tx,
          ctx.user.id,
          "organization.create",
          "organization",
          created.id
        );
        await tx.insert(s.notifications).values({
          userId: ctx.user.id,
          organizationId: created.id,
          audience: "client",
          title: "Organisation créée",
          message:
            "Votre organisation est enregistrée. Ajoutez vos sites et collaborateurs autorisés.",
        });
        return created;
      });
    }),
  detail: authenticated
    .input(z.object({ id: orgId }))
    .query(async ({ input, ctx }) => {
      const db = await dbRequired();
      await membership(db, input.id, ctx.user);
      // Scoped request reads also persist due proposal expirations without a fictitious scheduler.
      const requests = (await listScoped(ctx.user)).filter(
        r => r.organizationId === input.id
      );
      return db.transaction(async tx => {
        const p = await principal(tx, true);
        const role = await membership(tx, input.id, ctx.user);
        const [organization] = await tx
          .select({
            id: s.organizations.id,
            name: s.organizations.name,
            type: s.organizations.type,
            ownerUserId: s.organizations.ownerUserId,
          })
          .from(s.organizations)
          .where(eq(s.organizations.id, input.id));
        if (!organization)
          fail("Cette organisation est introuvable.", "NOT_FOUND");
        const sites = await tx
          .select({
            id: s.sites.id,
            name: s.sites.name,
            address: s.sites.address,
            postcode: s.sites.postcode,
            city: s.sites.city,
            contactName: s.sites.contactName,
            contactPhone: s.sites.contactPhone,
          })
          .from(s.sites)
          .where(eq(s.sites.organizationId, input.id));
        const members = await tx
          .select({
            id: s.members.id,
            userId: s.members.userId,
            name: s.users.name,
            email: s.users.email,
            role: s.members.role,
          })
          .from(s.members)
          .innerJoin(s.users, eq(s.members.userId, s.users.id))
          .where(eq(s.members.organizationId, input.id));
        const invitations =
          role.role !== "member"
            ? await tx
                .select({
                  id: s.invitations.id,
                  email: s.invitations.email,
                  role: s.invitations.role,
                  createdAt: s.invitations.createdAt,
                })
                .from(s.invitations)
                .where(
                  and(
                    eq(s.invitations.organizationId, input.id),
                    isNull(s.invitations.acceptedAt)
                  )
                )
            : [];
        let documents = await tx
          .select(documentFields)
          .from(s.documents)
          .where(eq(s.documents.organizationId, input.id));
        if (!(ctx.user.role === "admin" && ctx.user.id === p.artisanUserId)) {
          const drafts = await tx
            .select({ documentId: s.quoteDrafts.documentId })
            .from(s.quoteDrafts)
            .where(
              and(
                inArray(s.quoteDrafts.status, ["draft", "generated"]),
                inArray(
                  s.quoteDrafts.documentId,
                  documents.map(doc => doc.id)
                )
              )
            );
          const hidden = new Set(drafts.map(row => row.documentId));
          documents = documents.filter(doc => !hidden.has(doc.id));
        }
        const contracts = await tx
          .select({
            id: s.contracts.id,
            name: s.contracts.name,
            status: s.contracts.status,
            startAt: s.contracts.startAt,
            endAt: s.contracts.endAt,
            documentId: s.contracts.documentId,
          })
          .from(s.contracts)
          .where(eq(s.contracts.organizationId, input.id));
        return {
          organization,
          sites,
          members,
          invitations,
          requests,
          documents,
          contracts,
        };
      });
    }),
  addSite: authenticated
    .input(
      z.object({
        organizationId: orgId,
        name: z.string().trim().min(2).max(150),
        address: z.string().trim().min(5).max(250),
        postcode: z.string().regex(/^\d{5}$/),
        city: z.string().trim().min(2).max(100),
        contactName: z.string().trim().max(120),
        contactPhone: z.string().trim().max(30),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        await membership(tx, input.organizationId, ctx.user, true);
        const [created] = await tx.insert(s.sites).values(input).$returningId();
        await recordAudit(tx, ctx.user.id, "site.create", "site", created.id);
        await tx.insert(s.notifications).values({
          organizationId: input.organizationId,
          audience: "client",
          title: "Site ajouté",
          message: `Le site « ${input.name} » est maintenant enregistré.`,
        });
        return created;
      });
    }),
  invite: authenticated
    .input(
      z.object({
        organizationId: orgId,
        email: z.email().max(320),
        role: collaboratorRole,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        await membership(tx, input.organizationId, ctx.user, true);
        const invitationCode = randomBytes(32).toString("hex");
        const [created] = await tx
          .insert(s.invitations)
          .values({
            ...input,
            codeHash: hash(invitationCode),
            invitedBy: ctx.user.id,
            expiresAt: new Date(Date.now() + 7 * 86400000),
          })
          .$returningId();
        await recordAudit(
          tx,
          ctx.user.id,
          "invitation.create",
          "invitation",
          created.id
        );
        await tx.insert(s.notifications).values({
          userId: ctx.user.id,
          audience: "client",
          title: "Invitation manuelle créée",
          message: `Transmettez le code manuellement à ${input.email}. Aucun email n’a été envoyé. Le code expire dans 7 jours.`,
        });
        return { invitationCode };
      });
    }),
  join: authenticated
    .input(z.object({ code: z.string().regex(/^[a-f0-9]{64}$/) }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        const [invitation] = await tx
          .select()
          .from(s.invitations)
          .where(eq(s.invitations.codeHash, hash(input.code)))
          .for("update");
        if (!invitation || invitation.expiresAt <= new Date())
          fail("Cette invitation est invalide ou a expiré.", "FORBIDDEN");
        // Exact verified identity, never the email supplied in a request/contact form.
        const [identity] = await tx
          .select()
          .from(s.users)
          .where(eq(s.users.id, ctx.user.id));
        if (!identity?.email || identity.email !== invitation.email)
          fail(
            "L’email de votre identité OAuth doit correspondre exactement à celui de l’invitation.",
            "FORBIDDEN"
          );
        if (invitation.acceptedAt) {
          if (invitation.acceptedBy === ctx.user.id)
            return { success: true as const };
          fail("Cette invitation a déjà été utilisée.", "CONFLICT");
        }
        const [existing] = await tx
          .select()
          .from(s.members)
          .where(
            and(
              eq(s.members.organizationId, invitation.organizationId),
              eq(s.members.userId, ctx.user.id)
            )
          );
        if (!existing)
          await tx.insert(s.members).values({
            organizationId: invitation.organizationId,
            userId: ctx.user.id,
            role: invitation.role,
          });
        await tx
          .update(s.invitations)
          .set({ acceptedAt: new Date(), acceptedBy: ctx.user.id })
          .where(eq(s.invitations.id, invitation.id));
        await recordAudit(
          tx,
          ctx.user.id,
          "invitation.join",
          "organization",
          invitation.organizationId
        );
        await tx.insert(s.notifications).values({
          organizationId: invitation.organizationId,
          audience: "client",
          title: "Collaborateur autorisé",
          message:
            "Un collaborateur a rejoint l’organisation avec l’identité OAuth attendue.",
        });
        return { success: true as const };
      });
    }),
  removeMember: authenticated
    .input(z.object({ organizationId: orgId, userId: orgId }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        await membership(tx, input.organizationId, ctx.user, true);
        const [member] = await tx
          .select()
          .from(s.members)
          .where(
            and(
              eq(s.members.organizationId, input.organizationId),
              eq(s.members.userId, input.userId)
            )
          )
          .for("update");
        if (!member) fail("Ce collaborateur est introuvable.", "NOT_FOUND");
        if (member.role === "owner")
          fail(
            "Le propriétaire de l’organisation ne peut pas être retiré.",
            "FORBIDDEN"
          );
        await tx.delete(s.members).where(eq(s.members.id, member.id));
        await recordAudit(
          tx,
          ctx.user.id,
          "member.remove",
          "organization",
          input.organizationId
        );
        await tx.insert(s.notifications).values({
          organizationId: input.organizationId,
          audience: "client",
          title: "Accès collaborateur retiré",
          message: "L’accès du collaborateur a été retiré de l’organisation.",
        });
        return { success: true as const };
      });
    }),
});
