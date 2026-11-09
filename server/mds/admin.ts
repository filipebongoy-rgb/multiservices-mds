import { sql, desc, eq, inArray } from "drizzle-orm";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import { artisan, dbRequired, recordAudit } from "./common";
import { z } from "zod";

export const adminRouter = router({
  overview: artisan.query(async () => {
    const db = await dbRequired();

    // 1. Stats
    const allRequests = await db
      .select({
        id: s.requests.id,
        clientId: s.requests.clientId,
        status: s.requests.status,
        email: s.requests.email,
        name: s.requests.name,
        serviceName: s.requests.serviceName,
        problemType: s.requests.problemType,
        city: s.requests.city,
        createdAt: s.requests.createdAt,
        lastAction: s.requests.lastAction,
      })
      .from(s.requests);
    const succeedPayments = await db
      .select({ amountCents: s.payments.amountCents })
      .from(s.payments)
      .where(sql`${s.payments.status} = "succeeded"`);

    // 2. Dernières connexions (depuis users + audit)
    const logins = await db
      .select({
        id: s.audit.id,
        action: s.audit.action,
        userId: s.audit.actorUserId,
        createdAt: s.audit.createdAt,
      })
      .from(s.audit)
      .where(sql`${s.audit.action} = "user.login"`)
      .orderBy(desc(s.audit.id))
      .limit(30);

    const userList = await db
      .select({
        id: s.users.id,
        name: s.users.name,
        email: s.users.email,
        role: s.users.role,
        loginMethod: s.users.loginMethod,
        lastSignedIn: s.users.lastSignedIn,
        createdAt: s.users.createdAt,
      })
      .from(s.users)
      .orderBy(desc(s.users.lastSignedIn))
      .limit(30);

    // 3. Dernières demandes
    const requests = await db
      .select({
        id: s.requests.id,
        reference: s.requests.reference,
        status: s.requests.status,
        name: s.requests.name,
        phone: s.requests.phone,
        email: s.requests.email,
        postcode: s.requests.postcode,
        city: s.requests.city,
        serviceName: s.requests.serviceName,
        problemType: s.requests.problemType,
        desiredStart: s.requests.desiredStart,
        proposedPriceCents: s.requests.proposedPriceCents,
        createdAt: s.requests.createdAt,
      })
      .from(s.requests)
      .orderBy(desc(s.requests.id))
      .limit(30);

    // 4. Paiements (avec raisons d’échec)
    const payments = await db
      .select({
        id: s.payments.id,
        requestId: s.payments.requestId,
        purpose: s.payments.purpose,
        status: s.payments.status,
        amountCents: s.payments.amountCents,
        currency: s.payments.currency,
        provider: s.payments.provider,
        mode: s.payments.mode,
        failureReason: s.payments.failureReason,
        verificationNote: s.payments.verificationNote,
        confirmedAt: s.payments.confirmedAt,
        createdAt: s.payments.createdAt,
      })
      .from(s.payments)
      .orderBy(desc(s.payments.id))
      .limit(50);

    const requestIds = [
      ...new Set(
        payments.map(p => p.requestId).filter((id): id is number => id != null)
      ),
    ];
    const relatedRequests = requestIds.length
      ? await db
          .select({
            id: s.requests.id,
            reference: s.requests.reference,
            name: s.requests.name,
            email: s.requests.email,
          })
          .from(s.requests)
          .where(inArray(s.requests.id, requestIds))
      : [];
    const requestById = new Map(relatedRequests.map(r => [r.id, r]));
    const paymentsWithClient = payments.map(p => ({
      ...p,
      requestReference: p.requestId
        ? (requestById.get(p.requestId)?.reference ?? null)
        : null,
      clientName: p.requestId
        ? (requestById.get(p.requestId)?.name ?? null)
        : null,
      clientEmail: p.requestId
        ? (requestById.get(p.requestId)?.email ?? null)
        : null,
    }));

    const failures = paymentsWithClient.filter(p =>
      ["failed", "cancelled", "expired"].includes(p.status)
    );

    // 5. Zone configurée
    const [settingsRow] = await db
      .select({
        zone: s.settings.zone,
        contactPhone: s.settings.contactPhone,
        contactEmail: s.settings.contactEmail,
        calendarEnabled: s.settings.calendarEnabled,
      })
      .from(s.settings)
      .limit(1);
    const visitDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [visitTotals] = await db
      .select({ total: sql<number>`count(*)` })
      .from(s.siteVisits);
    const [todayVisitTotals] = await db
      .select({ total: sql<number>`count(*)` })
      .from(s.siteVisits)
      .where(sql`${s.siteVisits.visitDay} = ${visitDay}`);

    const countBy = (values: (string | null | undefined)[]) => {
      const counts = new Map<string, number>();
      for (const value of values) {
        const label = value?.trim() || "Non renseigné";
        counts.set(label, (counts.get(label) || 0) + 1);
      }
      return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort(
          (a, b) =>
            b.count - a.count || a.label.localeCompare(b.label, "fr")
        )
        .slice(0, 8);
    };
    const requestsByClient = new Map<number, number>();
    for (const request of allRequests) {
      requestsByClient.set(
        request.clientId,
        (requestsByClient.get(request.clientId) || 0) + 1
      );
    }
    const completedStatuses = ["completed", "invoiced", "paid", "closed"];
    const abandonedStatuses = [
      "refused",
      "cancelled",
      "expired",
      "quote_refused",
    ];
    const acceptedStatuses = [
      "accepted_mds",
      "proposed_slot",
      "needs_information",
      "awaiting_client",
      "confirmed",
      "planned",
      "en_route",
      "in_progress",
      ...completedStatuses,
    ];
    const totalRequests = allRequests.length;
    const completedRequests = allRequests.filter(request =>
      completedStatuses.includes(request.status)
    ).length;
    const acceptedRequests = allRequests.filter(request =>
      acceptedStatuses.includes(request.status)
    ).length;
    const repeatClients = [...requestsByClient.values()].filter(
      count => count > 1
    ).length;
    const recentClientActivity = [...allRequests]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 12)
      .map(request => ({
        id: request.id,
        clientId: request.clientId,
        name: request.name,
        serviceName: request.serviceName || request.problemType,
        city: request.city,
        status: request.status,
        lastAction: request.lastAction,
        createdAt: request.createdAt,
      }));

    return {
      stats: {
        totalRequests: allRequests.length,
        pendingRequests: allRequests.filter(r =>
          ["to_analyze", "awaiting_mds"].includes(r.status)
        ).length,
        confirmedRequests: allRequests.filter(r => r.status === "confirmed")
          .length,
        inProgressRequests: allRequests.filter(r =>
          ["en_route", "in_progress"].includes(r.status)
        ).length,
        finishedRequests: allRequests.filter(r =>
          ["completed", "invoiced", "paid", "closed"].includes(r.status)
        ).length,
        clients: new Set(allRequests.map(r => r.email).filter(Boolean)).size,
        revenueCents: succeedPayments.reduce(
          (acc, p) => acc + (p.amountCents || 0),
          0
        ),
      },
      users: userList,
      logins,
      requests,
      payments: paymentsWithClient,
      failures,
      reviews: await db
        .select({
          id: s.reviews.id,
          requestId: s.reviews.requestId,
          rating: s.reviews.rating,
          comment: s.reviews.comment,
          moderation: s.reviews.moderation,
          serviceName: s.requests.serviceName,
          city: s.requests.city,
          clientName: s.requests.name,
          createdAt: s.reviews.createdAt,
        })
        .from(s.reviews)
        .innerJoin(s.requests, eq(s.requests.id, s.reviews.requestId))
        .where(eq(s.reviews.moderation, "pending"))
        .orderBy(desc(s.reviews.createdAt))
        .limit(20),
      zone: settingsRow?.zone || "",
      contactPhone: settingsRow?.contactPhone || "",
      contactEmail: settingsRow?.contactEmail || "",
      calendarEnabled: Boolean(settingsRow?.calendarEnabled),
      siteVisits: {
        total: Number(visitTotals?.total || 0),
        today: Number(todayVisitTotals?.total || 0),
        definition: "Visiteurs uniques par empreinte hachée et par jour",
      },
      clientInsights: {
        totalRequests,
        acceptedRequests,
        completedRequests,
        abandonedRequests: allRequests.filter(request =>
          abandonedStatuses.includes(request.status)
        ).length,
        conversionRate: totalRequests
          ? Math.round((completedRequests / totalRequests) * 100)
          : 0,
        acceptanceRate: totalRequests
          ? Math.round((acceptedRequests / totalRequests) * 100)
          : 0,
        repeatClients,
        serviceDemand: countBy(
          allRequests.map(request => request.serviceName || request.problemType)
        ),
        cityDemand: countBy(allRequests.map(request => request.city)),
        recentActivity: recentClientActivity,
      },
    };
  }),
  moderateReview: artisan
    .input(
      z.object({
        id: z.number().int().positive(),
        moderation: z.enum(["approved", "hidden"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      const [review] = await db
        .select({ id: s.reviews.id })
        .from(s.reviews)
        .where(eq(s.reviews.id, input.id));
      if (!review) throw new Error("Cet avis est introuvable.");
      await db
        .update(s.reviews)
        .set({ moderation: input.moderation })
        .where(eq(s.reviews.id, input.id));
      await recordAudit(
        db,
        ctx.user.id,
        `review.${input.moderation}`,
        "review",
        input.id,
      );
      return { success: true as const };
    }),
});
