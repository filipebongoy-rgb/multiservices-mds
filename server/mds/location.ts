import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "../../drizzle/schema";
import { trackingLocationSchema, trackSchema } from "../../shared/mds";
import { artisan, authorizeRequest, dbRequired, procedure } from "./common";
import { fail } from "./workflow";
import { router } from "../_core/trpc";

export const locationRouter = router({
  push: artisan
    .input(trackingLocationSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      const [request] = await db
        .select({ id: s.requests.id, status: s.requests.status })
        .from(s.requests)
        .where(eq(s.requests.id, input.requestId));
      if (!request) fail("Cette intervention est introuvable.", "NOT_FOUND");
      if (request.status !== "en_route")
        fail(
          "Le partage GPS est accepté uniquement pendant le trajet vers le client.",
          "CONFLICT"
        );
      const [intervention] = await db
        .select({ arrivedAt: s.interventions.arrivedAt })
        .from(s.interventions)
        .where(eq(s.interventions.requestId, input.requestId));
      if (intervention?.arrivedAt)
        fail(
          "Le partage GPS est arrêté après l’arrivée sur place.",
          "CONFLICT"
        );
      await db.insert(s.locationUpdates).values({
        requestId: input.requestId,
        artisanUserId: ctx.user.id,
        latitudeE6: Math.round(input.latitude * 1_000_000),
        longitudeE6: Math.round(input.longitude * 1_000_000),
        accuracyM: input.accuracyM == null ? null : Math.round(input.accuracyM),
      });
      return { accepted: true as const };
    }),
  latest: procedure.input(trackSchema).query(async ({ input, ctx }) => {
    const db = await dbRequired();
    const [request] = await db
      .select()
      .from(s.requests)
      .where(eq(s.requests.reference, input.reference));
    if (!request) fail("Cette demande est introuvable.", "NOT_FOUND");
    await authorizeRequest(db, request, ctx.user, input.token);
    if (request.status !== "en_route") return null;
    const [intervention] = await db
      .select({ arrivedAt: s.interventions.arrivedAt })
      .from(s.interventions)
      .where(eq(s.interventions.requestId, request.id));
    if (intervention?.arrivedAt) return null;
    const [point] = await db
      .select()
      .from(s.locationUpdates)
      .where(eq(s.locationUpdates.requestId, request.id))
      .orderBy(desc(s.locationUpdates.recordedAt), desc(s.locationUpdates.id))
      .limit(1);
    if (!point) return null;
    return {
      latitude: point.latitudeE6 / 1_000_000,
      longitude: point.longitudeE6 / 1_000_000,
      accuracyM: point.accuracyM,
      recordedAt: point.recordedAt,
    };
  }),
});
