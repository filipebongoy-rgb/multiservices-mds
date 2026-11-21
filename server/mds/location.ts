import { and, desc, eq, isNull } from "drizzle-orm";
import * as s from "../../drizzle/schema";
import { trackingLocationSchema, trackSchema } from "../../shared/mds";
import {
  APPROACH_DISTANCE_M,
  MAPBOX_PUBLIC_TOKEN,
  STALE_POSITION_MS,
  distanceMeters,
} from "../../shared/mapbox";
import {
  artisan,
  authorizeRequest,
  dbRequired,
  event,
  procedure,
  type SqlDb,
} from "./common";
import { fail } from "./workflow";
import { router } from "../_core/trpc";

type Point = { latitude: number; longitude: number };

/**
 * Géocode l'adresse réelle du dossier via Mapbox. Retourne null en cas
 * d'échec : aucune coordonnée n'est jamais inventée.
 */
async function geocodeAddress(request: s.MdsRequest): Promise<Point | null> {
  const query = `${request.address}, ${request.postcode} ${request.city}`;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?country=fr&limit=1&language=fr&access_token=${MAPBOX_PUBLIC_TOKEN}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      features?: { center?: [number, number] }[];
    };
    const center = data.features?.[0]?.center;
    if (!center) return null;
    return { longitude: center[0], latitude: center[1] };
  } catch {
    return null;
  }
}

async function latestPoint(db: SqlDb, requestId: number) {
  const [point] = await db
    .select()
    .from(s.locationUpdates)
    .where(eq(s.locationUpdates.requestId, requestId))
    .orderBy(desc(s.locationUpdates.recordedAt), desc(s.locationUpdates.id))
    .limit(1);
  return point ?? null;
}

/**
 * Distance réelle entre la dernière position GPS récente et l'adresse.
 * Null si le GPS est absent, périmé ou si la destination est inconnue :
 * dans ce cas aucune règle de proximité n'est appliquée.
 */
export async function arrivalProximity(db: SqlDb, requestId: number) {
  const [intervention] = await db
    .select({
      destinationLatE6: s.interventions.destinationLatE6,
      destinationLngE6: s.interventions.destinationLngE6,
    })
    .from(s.interventions)
    .where(eq(s.interventions.requestId, requestId));
  if (
    intervention?.destinationLatE6 == null ||
    intervention.destinationLngE6 == null
  )
    return null;
  const point = await latestPoint(db, requestId);
  if (!point) return null;
  if (Date.now() - new Date(point.recordedAt).getTime() > STALE_POSITION_MS)
    return null;
  return {
    distanceM: distanceMeters(
      {
        latitude: point.latitudeE6 / 1_000_000,
        longitude: point.longitudeE6 / 1_000_000,
      },
      {
        latitude: intervention.destinationLatE6 / 1_000_000,
        longitude: intervention.destinationLngE6 / 1_000_000,
      }
    ),
  };
}

export const locationRouter = router({
  push: artisan
    .input(trackingLocationSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      const [request] = await db
        .select()
        .from(s.requests)
        .where(eq(s.requests.id, input.requestId));
      if (!request) fail("Cette intervention est introuvable.", "NOT_FOUND");
      if (request.status !== "en_route")
        fail(
          "Le partage GPS est accepté uniquement pendant le trajet vers le client.",
          "CONFLICT"
        );
      const [intervention] = await db
        .select()
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
      if (!intervention) return { accepted: true as const, approaching: false };

      // Destination géocodée une seule fois par trajet.
      let destination: Point | null =
        intervention.destinationLatE6 != null &&
        intervention.destinationLngE6 != null
          ? {
              latitude: intervention.destinationLatE6 / 1_000_000,
              longitude: intervention.destinationLngE6 / 1_000_000,
            }
          : null;
      if (!destination) {
        destination = await geocodeAddress(request);
        if (destination)
          await db
            .update(s.interventions)
            .set({
              destinationLatE6: Math.round(destination.latitude * 1_000_000),
              destinationLngE6: Math.round(destination.longitude * 1_000_000),
            })
            .where(eq(s.interventions.id, intervention.id));
      }

      // Notification d'approche, envoyée une seule fois et uniquement
      // sur la base d'une position GPS réelle.
      let approaching = false;
      if (destination && !intervention.approachNotifiedAt) {
        const distance = distanceMeters(input, destination);
        if (distance <= APPROACH_DISTANCE_M) {
          const result = await db
            .update(s.interventions)
            .set({ approachNotifiedAt: new Date() })
            .where(
              and(
                eq(s.interventions.id, intervention.id),
                isNull(s.interventions.approachNotifiedAt)
              )
            ).returning({ id: s.interventions.id });
          if (result.length > 0) {
            approaching = true;
            await event(
              db,
              request,
              "en_route",
              "Votre artisan MDS est à moins d’un kilomètre de votre adresse. Préparez-vous à l’accueillir.",
              "system",
              null,
              "Artisan bientôt arrivé"
            );
          }
        }
      }
      return { accepted: true as const, approaching };
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
      .select({
        arrivedAt: s.interventions.arrivedAt,
        approachNotifiedAt: s.interventions.approachNotifiedAt,
      })
      .from(s.interventions)
      .where(eq(s.interventions.requestId, request.id));
    if (intervention?.arrivedAt) return null;
    const point = await latestPoint(db, request.id);
    if (!point) return null;
    const ageMs = Date.now() - new Date(point.recordedAt).getTime();
    return {
      latitude: point.latitudeE6 / 1_000_000,
      longitude: point.longitudeE6 / 1_000_000,
      accuracyM: point.accuracyM,
      recordedAt: point.recordedAt,
      stale: ageMs > STALE_POSITION_MS,
      approaching: Boolean(intervention?.approachNotifiedAt),
    };
  }),
});
