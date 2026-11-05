import { calendarRouter } from "./calendar";
import { operationsRouter } from "./operations";
import { quoteBuilderRouter } from "./quote-builder";
import { automationRouter } from "./automation";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import { serviceSchema } from "../../shared/mds";
import {
  artisan,
  authenticated,
  authorizeRequest,
  dbRequired,
  event,
  hash,
  orgIds,
  principal,
  procedure,
  recordAudit,
  requestFilter,
  secureEqual,
  type SqlDb,
} from "./common";
import { fail, finishedStates } from "./workflow";
import { requestsRouter } from "./requests";
import { organizationsRouter } from "./organizations";
import { documentsRouter } from "./documents";
import {
  catalogPricingSchema,
  normalizeService,
  pricingConfiguration,
  resolvePricing,
} from "./tariffs";
import { paymentsRouter } from "./payments";
import { locationRouter } from "./location";
import { clientsRouter } from "./clients";
const identifier = z.object({ id: z.number().int().positive() });
const settingsSchema = z.object({
  zone: z.string().trim().max(300),
  contactEmail: z.union([z.literal(""), z.email().max(320)]),
  contactPhone: z.string().trim().max(30),
  businessAddress: z.string().trim().max(500),
  legalName: z.string().trim().max(200),
  legalNotice: z.string().trim().max(10000),
  proposalExpiryHours: z.number().int().min(1).max(720),
});
function safeSettings(row: typeof s.settings.$inferSelect) {
  const {
    zone,
    contactEmail,
    contactPhone,
    businessAddress,
    legalName,
    legalNotice,
    proposalExpiryHours,
  } = row;
  return {
    zone,
    contactEmail,
    contactPhone,
    businessAddress,
    legalName,
    legalNotice,
    proposalExpiryHours,
  };
}
function safeService(row: typeof s.services.$inferSelect) {
  const { seedKey, deletedAt, ...value } = normalizeService(row);
  return value;
}
async function notificationFilter(db: SqlDb, user: s.User) {
  const p = await principal(db);
  const ids = await orgIds(db, user.id);
  if (user.role === "admin" && p.artisanUserId === user.id)
    return or(
      and(
        eq(s.notifications.audience, "artisan"),
        or(isNull(s.notifications.userId), eq(s.notifications.userId, user.id))
      ),
      and(
        eq(s.notifications.audience, "client"),
        eq(s.notifications.userId, user.id)
      )
    )!;
  return and(
    eq(s.notifications.audience, "client"),
    or(
      and(
        isNull(s.notifications.organizationId),
        eq(s.notifications.userId, user.id)
      ),
      ids.length ? inArray(s.notifications.organizationId, ids) : sql`false`
    )
  )!;
}
export const mdsRouter = router({
  profile: router({
    me: authenticated.query(async ({ ctx }) => {
      const db = await dbRequired();
      const [user] = await db
        .select({
          id: s.users.id,
          name: s.users.name,
          email: s.users.email,
          role: s.users.role,
          createdAt: s.users.createdAt,
        })
        .from(s.users)
        .where(eq(s.users.id, ctx.user.id));
      if (!user) fail("Votre profil est introuvable.", "NOT_FOUND");
      return user;
    }),
    update: authenticated
      .input(z.object({ name: z.string().trim().min(2).max(120) }))
      .mutation(async ({ input, ctx }) => {
        const db = await dbRequired();
        return db.transaction(async tx => {
          const [changed] = await tx
            .update(s.users)
            .set({ name: input.name })
            .where(eq(s.users.id, ctx.user.id));
          if (changed.affectedRows !== 1)
            fail("Votre profil est introuvable.", "NOT_FOUND");
          await recordAudit(
            tx,
            ctx.user.id,
            "profile.update",
            "user",
            ctx.user.id
          );
          return { success: true as const, name: input.name };
        });
      }),
  }),
  claimArtisan: authenticated
    .input(z.object({ code: z.string().regex(/^[a-f0-9]{64}$/) }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        const p = await principal(tx, true);
        if (p.artisanUserId || p.activationUsedAt)
          fail(
            "L’espace artisan a déjà été activé. Une seconde activation est impossible.",
            "CONFLICT"
          );
        if (
          !p.activationHash ||
          !secureEqual(p.activationHash, hash(input.code))
        )
          fail("Le code d’activation est invalide.", "FORBIDDEN");
        const existing = await tx
          .select({ id: s.users.id })
          .from(s.users)
          .where(eq(s.users.role, "admin"))
          .limit(1);
        if (existing.length)
          fail(
            "Un rôle artisan existe déjà. Une vérification opérateur est nécessaire.",
            "CONFLICT"
          );
        await tx
          .update(s.settings)
          .set({
            artisanUserId: ctx.user.id,
            activationHash: null,
            activationUsedAt: new Date(),
          })
          .where(eq(s.settings.id, 1));
        await tx
          .update(s.users)
          .set({ role: "admin" })
          .where(eq(s.users.id, ctx.user.id));
        await recordAudit(
          tx,
          ctx.user.id,
          "artisan.claim",
          "user",
          ctx.user.id
        );
        await tx.insert(s.notifications).values({
          userId: ctx.user.id,
          audience: "artisan",
          title: "Espace artisan activé",
          message:
            "Votre identité OAuth est désormais l’unique artisan MDS. Configurez vos coordonnées et vos prestations avant de les activer.",
        });
        return { success: true as const };
      });
    }),
  catalog: router({
    list: procedure
      .input(z.object({ includeInactive: z.boolean().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const db = await dbRequired();
        const p = await principal(db);
        if (
          input?.includeInactive &&
          (!ctx.user ||
            ctx.user.role !== "admin" ||
            p.artisanUserId !== ctx.user.id)
        )
          fail("Le catalogue inactif est réservé à l’artisan.", "FORBIDDEN");
        const rows = await db
          .select()
          .from(s.services)
          .where(
            and(
              isNull(s.services.deletedAt),
              input?.includeInactive ? sql`true` : eq(s.services.active, true)
            )
          )
          .orderBy(s.services.id);
        return rows.map(safeService);
      }),
    pricing: procedure.input(catalogPricingSchema).query(async ({ input }) => {
      const { snapshot, fingerprint } = await resolvePricing(
        await dbRequired(),
        input.serviceId,
        input.postcode
      );
      return { snapshot, fingerprint };
    }),
    save: artisan.input(serviceSchema).mutation(async ({ input, ctx }) => {
      if (
        input.photoUrl &&
        !/^(https:\/\/[^\s]+|\/manus-storage\/[A-Za-z0-9_.\/-]+)$/.test(
          input.photoUrl
        )
      )
        fail(
          "La photo de prestation doit utiliser une adresse HTTPS ou le stockage du projet."
        );
      if (
        input.active &&
        (!input.description.trim() ||
          !input.zone.trim() ||
          (input.pricingMode === "quote" && !input.pricingRule.trim()) ||
          (input.pricingMode === "fixed" && !input.conditions.trim()))
      )
        fail(
          "Avant activation, renseignez description, zone, conditions et tarif ou règle de devis."
        );
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        const { id, ...values } = input;
        let serviceId = id;
        if (id) {
          const [previous] = await tx
            .select()
            .from(s.services)
            .where(and(eq(s.services.id, id), isNull(s.services.deletedAt)));
          if (!previous) fail("Cette prestation est introuvable.", "NOT_FOUND");
          const configuration = pricingConfiguration(values);
          const changed =
            JSON.stringify(pricingConfiguration(normalizeService(previous))) !==
            JSON.stringify(configuration);
          await tx
            .update(s.services)
            .set({
              ...values,
              pricingVersion: previous.pricingVersion + (changed ? 1 : 0),
            })
            .where(eq(s.services.id, id));
          if (changed) {
            const revisedAt = new Date();
            await tx
              .update(s.tariffs)
              .set({ validUntil: revisedAt })
              .where(
                and(eq(s.tariffs.serviceId, id), isNull(s.tariffs.validUntil))
              );
            await tx.insert(s.tariffs).values({
              serviceId: id,
              priceCents: values.priceCents,
              rule: values.pricingRule,
              configuration,
              validFrom: revisedAt,
            });
          }
        } else {
          const [created] = await tx
            .insert(s.services)
            .values({ ...values, pricingVersion: 1 })
            .$returningId();
          serviceId = created.id;
          await tx.insert(s.tariffs).values({
            serviceId: created.id,
            priceCents: values.priceCents,
            rule: values.pricingRule,
            configuration: pricingConfiguration(values),
          });
        }
        await recordAudit(
          tx,
          ctx.user.id,
          "catalog.save",
          "service",
          serviceId!
        );
        await tx.insert(s.notifications).values({
          userId: ctx.user.id,
          audience: "artisan",
          title: "Catalogue mis à jour",
          message: `La prestation « ${input.name} » est ${input.active ? "active" : "inactive"}. Les dossiers existants restent inchangés.`,
        });
        const [saved] = await tx
          .select()
          .from(s.services)
          .where(eq(s.services.id, serviceId!));
        return safeService(saved);
      });
    }),
    remove: artisan.input(identifier).mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        const [service] = await tx
          .select()
          .from(s.services)
          .where(eq(s.services.id, input.id));
        if (!service) fail("Cette prestation est introuvable.", "NOT_FOUND");
        await tx
          .update(s.services)
          .set({ active: false, deletedAt: new Date() })
          .where(eq(s.services.id, input.id));
        await recordAudit(
          tx,
          ctx.user.id,
          "catalog.remove",
          "service",
          input.id
        );
        await tx.insert(s.notifications).values({
          userId: ctx.user.id,
          audience: "artisan",
          title: "Prestation retirée",
          message:
            "La prestation a été retirée du catalogue sans supprimer ses anciens dossiers.",
        });
        return { success: true as const };
      });
    }),
  }),
  settings: router({
    public: procedure.query(async () =>
      safeSettings(await principal(await dbRequired()))
    ),
    get: artisan.query(async () =>
      safeSettings(await principal(await dbRequired()))
    ),
    save: artisan.input(settingsSchema).mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        await tx.update(s.settings).set(input).where(eq(s.settings.id, 1));
        await recordAudit(tx, ctx.user.id, "settings.save", "settings", 1);
        await tx.insert(s.notifications).values({
          userId: ctx.user.id,
          audience: "artisan",
          title: "Paramètres enregistrés",
          message:
            "Les coordonnées et règles de proposition MDS ont été enregistrées.",
        });
        return { success: true as const };
      });
    }),
  }),
  calendar: calendarRouter,
  operations: operationsRouter,
  quoteBuilder: quoteBuilderRouter,
  automation: automationRouter,
  requests: requestsRouter,
  organizations: organizationsRouter,
  documents: documentsRouter,
  payments: paymentsRouter,
  location: locationRouter,
  clients: clientsRouter,
  reviews: router({
    submit: authenticated
      .input(
        z.object({
          requestId: z.number().int().positive(),
          rating: z.number().int().min(1).max(5),
          comment: z.string().trim().max(3000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await dbRequired();
        return db.transaction(async tx => {
          const p = await principal(tx, true);
          const [request] = await tx
            .select()
            .from(s.requests)
            .where(eq(s.requests.id, input.requestId))
            .for("update");
          if (!request) fail("Cette demande est introuvable.", "NOT_FOUND");
          await authorizeRequest(tx, request, ctx.user);
          if (!finishedStates.includes(request.status))
            fail(
              "Une évaluation n’est possible qu’après une intervention réellement terminée.",
              "CONFLICT"
            );
          const [intervention] = await tx
            .select()
            .from(s.interventions)
            .where(eq(s.interventions.requestId, request.id));
          if (!intervention?.completedAt)
            fail(
              "Aucune intervention terminée n’est liée à ce dossier.",
              "CONFLICT"
            );
          const authorType =
            p.artisanUserId === ctx.user.id && ctx.user.role === "admin"
              ? ("artisan" as const)
              : ("client" as const);
          const [existing] = await tx
            .select()
            .from(s.reviews)
            .where(
              and(
                eq(s.reviews.requestId, request.id),
                eq(s.reviews.authorType, authorType)
              )
            );
          if (existing)
            fail(
              "Une évaluation de ce rôle existe déjà pour cette intervention.",
              "CONFLICT"
            );
          const [created] = await tx
            .insert(s.reviews)
            .values({
              ...input,
              comment: input.comment || null,
              interventionId: intervention.id,
              authorUserId: ctx.user.id,
              authorType,
              moderation: "pending",
            })
            .$returningId();
          await recordAudit(
            tx,
            ctx.user.id,
            "review.submit",
            "review",
            created.id
          );
          await event(
            tx,
            request,
            request.status,
            "Une évaluation privée liée à l’intervention terminée a été déposée. Elle n’est pas publiée.",
            authorType,
            ctx.user.id
          );
          return { success: true as const };
        });
      }),
  }),
  notifications: router({
    list: authenticated.query(async ({ ctx }) => {
      const db = await dbRequired();
      const rows = await db
        .select({
          id: s.notifications.id,
          title: s.notifications.title,
          message: s.notifications.message,
          requestId: s.notifications.requestId,
          readAt: s.notificationReads.readAt,
          createdAt: s.notifications.createdAt,
        })
        .from(s.notifications)
        .leftJoin(
          s.notificationReads,
          and(
            eq(s.notificationReads.notificationId, s.notifications.id),
            eq(s.notificationReads.userId, ctx.user.id)
          )
        )
        .where(await notificationFilter(db, ctx.user))
        .orderBy(s.notifications.id);
      return rows.reverse();
    }),
    read: authenticated.input(identifier).mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        const [notification] = await tx
          .select({ id: s.notifications.id })
          .from(s.notifications)
          .where(
            and(
              eq(s.notifications.id, input.id),
              await notificationFilter(tx, ctx.user)
            )
          );
        if (!notification)
          fail("Cette notification n’est pas accessible.", "FORBIDDEN");
        await tx
          .insert(s.notificationReads)
          .values({ notificationId: input.id, userId: ctx.user.id })
          .onDuplicateKeyUpdate({ set: { notificationId: input.id } });
        return { success: true as const };
      });
    }),
  }),
  audit: router({
    list: artisan.query(async () =>
      (
        await (
          await dbRequired()
        )
          .select({
            id: s.audit.id,
            action: s.audit.action,
            entityType: s.audit.entityType,
            entityId: s.audit.entityId,
            createdAt: s.audit.createdAt,
          })
          .from(s.audit)
          .orderBy(s.audit.id)
      ).reverse()
    ),
  }),
  appointments: router({
    list: authenticated.query(async ({ ctx }) => {
      const db = await dbRequired();
      return db
        .select({
          id: s.appointments.id,
          reference: s.requests.reference,
          requestId: s.requests.id,
          startAt: s.appointments.startAt,
          endAt: s.appointments.endAt,
          status: s.appointments.status,
          name: s.requests.name,
          address: s.requests.address,
        })
        .from(s.appointments)
        .innerJoin(s.requests, eq(s.appointments.requestId, s.requests.id))
        .where(await requestFilter(db, ctx.user))
        .orderBy(s.appointments.startAt);
    }),
  }),
});
