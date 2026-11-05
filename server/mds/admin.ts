import { sql, desc, inArray } from "drizzle-orm";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import { artisan, dbRequired } from "./common";

export const adminRouter = router({
  overview: artisan.query(async () => {
    const db = await dbRequired();

    // 1. Stats
    const allRequests = await db
      .select({
        status: s.requests.status,
        email: s.requests.email,
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
      zone: settingsRow?.zone || "",
      contactPhone: settingsRow?.contactPhone || "",
      contactEmail: settingsRow?.contactEmail || "",
      calendarEnabled: Boolean(settingsRow?.calendarEnabled),
    };
  }),
});
