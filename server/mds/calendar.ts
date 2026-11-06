import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import { calendarSettingsSchema } from "../../shared/operations";
import {
  artisan,
  dbRequired,
  principal,
  procedure,
  recordAudit,
  requireArtisan,
  workspaceOwnerId,
  type SqlDb,
} from "./common";
import { fail, overlaps } from "./workflow";

const MINUTE = 60_000;
const DAY = 86_400_000;
const TIMEZONE = "Europe/Paris";
const busyStatuses = ["confirmed", "in_progress", "completed"] as const;
type Range = { startAt: Date; endAt: Date };
type Config = z.infer<typeof calendarSettingsSchema>;
type Period = typeof s.availability.$inferSelect;
type Appointment = typeof s.appointments.$inferSelect;
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function localParts(date: Date) {
  const parts = formatter.formatToParts(date);
  const get = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === name)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}
export function parisDay(date: Date) {
  const p = localParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
/** Resolve a Paris wall time only when precisely one UTC instant exists (DST safe). */
export function parisLocalToDate(day: string, time: string): Date | null {
  if (!validDay(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const [h, minute] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, minute);
  const offsets = new Set<number>();
  for (const delta of [-36, 0, 36]) {
    const sample = new Date(wall + delta * 60 * MINUTE);
    const p = localParts(sample);
    offsets.add(
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
        sample.getTime()
    );
  }
  const matches = [...offsets]
    .map(offset => new Date(wall - offset))
    .filter(date => {
      const p = localParts(date);
      return (
        p.year === y &&
        p.month === m &&
        p.day === d &&
        p.hour === h &&
        p.minute === minute
      );
    });
  return matches.length === 1 ? matches[0] : null;
}
function uniqueLocalInstant(date: Date) {
  const p = localParts(date);
  const resolved = parisLocalToDate(
    parisDay(date),
    `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
  );
  return (
    !!resolved &&
    resolved.getTime() === Math.floor(date.getTime() / MINUTE) * MINUTE
  );
}
function configFrom(row: typeof s.settings.$inferSelect): Config {
  return {
    enabled: row.calendarEnabled ?? false,
    timezone: TIMEZONE,
    weeklyWindows: row.weeklyWindows ?? [],
    travelZones: row.travelZones ?? [],
    bufferMinutes: row.bufferMinutes ?? 0,
    horizonDays: row.horizonDays ?? 90,
  };
}
function configured(config: Config) {
  return config.enabled && calendarSettingsSchema.safeParse(config).success;
}
function occupied(
  range: Range & {
    travelMinutes?: number | null;
    bufferMinutes?: number | null;
  }
): Range {
  return {
    startAt: new Date(
      range.startAt.getTime() - (range.travelMinutes ?? 0) * MINUTE
    ),
    endAt: new Date(
      range.endAt.getTime() + (range.bufferMinutes ?? 0) * MINUTE
    ),
  };
}
function zoneMinutes(config: Config, postcode: string): number | null {
  if (!/^\d{5}$/.test(postcode)) return null;
  const zone = [...config.travelZones]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find(z => postcode.startsWith(z.prefix));
  return zone?.travelMinutes ?? null;
}
function weeklyRanges(config: Config, day: string): Range[] {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
  return config.weeklyWindows
    .filter(w => w.weekday === weekday)
    .flatMap(w => {
      const startAt = parisLocalToDate(day, w.start),
        endAt = parisLocalToDate(day, w.end);
      return startAt && endAt && endAt > startAt ? [{ startAt, endAt }] : [];
    });
}
function addDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function containsRange(ranges: Range[], target: Range) {
  const sorted = ranges
    .filter(r => r.endAt > r.startAt)
    .sort((a, b) => +a.startAt - +b.startAt);
  let coveredUntil = target.startAt.getTime();
  for (const range of sorted) {
    if (+range.endAt <= coveredUntil) continue;
    if (+range.startAt > coveredUntil) return false;
    coveredUntil = +range.endAt;
    if (coveredUntil >= +target.endAt) return true;
  }
  return false;
}
function allowed(config: Config, periods: Period[], range: Range) {
  const ranges = periods
    .filter(p => p.kind === "available")
    .map(p => ({ startAt: p.startAt, endAt: p.endAt }));
  const first = parisDay(range.startAt),
    last = parisDay(range.endAt);
  // Appointment duration is capped at one day; travel/buffer can add one adjacent day each.
  for (let day = first, i = 0; day <= last && i < 4; day = addDays(day, 1), i++)
    ranges.push(...weeklyRanges(config, day));
  return containsRange(ranges, range);
}
function failureReason(
  config: Config,
  periods: Period[],
  appointments: Appointment[],
  times: Range,
  postcode: string,
  now: Date
): string | null {
  if (
    !Number.isFinite(+times.startAt) ||
    !Number.isFinite(+times.endAt) ||
    times.endAt <= times.startAt ||
    +times.endAt - +times.startAt > DAY
  )
    return "Le créneau doit avoir une durée positive d’au plus 24 heures.";
  let travelMinutes = 0,
    bufferMinutes = 0;
  if (config.enabled) {
    if (!configured(config))
      return "Le calendrier MDS doit être configuré avant la confirmation.";
    const travel = zoneMinutes(config, postcode);
    if (travel === null)
      return "Cette adresse n’est pas couverte par les zones du calendrier. Contactez MDS.";
    travelMinutes = travel;
    bufferMinutes = config.bufferMinutes;
    if (times.startAt <= now || +times.endAt > +now + config.horizonDays * DAY)
      return "Le créneau est passé ou dépasse l’horizon du calendrier.";
    if (!uniqueLocalInstant(times.startAt) || !uniqueLocalInstant(times.endAt))
      return "Cette heure de Paris est ambiguë ou inexistante (changement d’heure). Choisissez une autre heure.";
  }
  const target = occupied({ ...times, travelMinutes, bufferMinutes });
  if (config.enabled && target.startAt <= now)
    return "Le temps nécessaire au déplacement ne permet plus ce créneau. Choisissez une heure ultérieure.";
  if (periods.some(p => p.kind === "blocked" && overlaps(target, p)))
    return "Le créneau entre en conflit avec une indisponibilité MDS.";
  if (appointments.some(a => overlaps(target, occupied(a))))
    return "Le créneau entre en conflit avec un rendez-vous confirmé, son déplacement ou sa marge de sécurité.";
  if (config.enabled && !allowed(config, periods, target))
    return "Le créneau et ses temps de déplacement/sécurité dépassent les horaires disponibles.";
  return null;
}
async function state(db: SqlDb, row: typeof s.settings.$inferSelect) {
  const config = configFrom(row);
  const periods = await db
    .select()
    .from(s.availability)
    .where(
      config.enabled
        ? eq(s.availability.artisanUserId, row.artisanUserId ?? -1)
        : undefined
    );
  const appointments = await db
    .select()
    .from(s.appointments)
    .where(inArray(s.appointments.status, [...busyStatuses]));
  return { config, periods, appointments };
}
/** Caller MUST hold principal(tx, true) in the same transaction through appointment insertion. */
export async function checkCalendar(
  tx: SqlDb,
  times: Range,
  request: Pick<s.MdsRequest, "id" | "postcode">
): Promise<{ travelMinutes: number; bufferMinutes: number }> {
  const row = await principal(tx);
  const current = await state(tx, row);
  const reason = failureReason(
    current.config,
    current.periods,
    current.appointments,
    times,
    request.postcode,
    new Date()
  );
  if (reason) fail(reason, "CONFLICT");
  return current.config.enabled
    ? {
        travelMinutes: zoneMinutes(current.config, request.postcode)!,
        bufferMinutes: current.config.bufferMinutes,
      }
    : { travelMinutes: 0, bufferMinutes: 0 };
}
const identifier = z.object({ id: z.number().int().positive() });
const periodInput = z
  .object({
    id: z.number().int().positive().optional(),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    kind: z.enum(["available", "blocked"]),
    note: z.string().trim().max(1000).default(""),
  })
  .refine(
    v =>
      +new Date(v.endAt) > +new Date(v.startAt) &&
      +new Date(v.endAt) - +new Date(v.startAt) <= 366 * DAY,
    "La période doit être croissante et ne pas dépasser 366 jours."
  );
const slotsInput = z.object({
  serviceId: z.number().int().positive().nullable(),
  postcode: z.string().regex(/^\d{5}$/),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2}|\d{8})$/),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
});
export const calendarRouter = router({
  get: artisan.query(async ({ ctx }) => {
    const db = await dbRequired();
    const row = await principal(db);
    const ownerId = await workspaceOwnerId(db, ctx.user);
    const periods = await db
      .select({
        id: s.availability.id,
        startAt: s.availability.startAt,
        endAt: s.availability.endAt,
        kind: s.availability.kind,
        note: s.availability.note,
      })
      .from(s.availability)
      .where(eq(s.availability.artisanUserId, ownerId));
    const appointments = await db
      .select({
        id: s.appointments.id,
        requestId: s.appointments.requestId,
        startAt: s.appointments.startAt,
        endAt: s.appointments.endAt,
        status: s.appointments.status,
        travelMinutes: s.appointments.travelMinutes,
        bufferMinutes: s.appointments.bufferMinutes,
      })
      .from(s.appointments)
      .where(inArray(s.appointments.status, [...busyStatuses]));
    // Only the verified single artisan can access this data. No hashes, tokens or contact secrets.
    const requests = await db
      .select({
        id: s.requests.id,
        reference: s.requests.reference,
        name: s.requests.name,
        address: s.requests.address,
        postcode: s.requests.postcode,
      })
      .from(s.requests);
    const byId = new Map(requests.map(request => [request.id, request]));
    return {
      settings: configFrom(row),
      periods,
      appointments: appointments
        .flatMap(appointment => {
          const request = byId.get(appointment.requestId);
          return request
            ? [
                {
                  ...appointment,
                  reference: request.reference,
                  name: request.name,
                  address: request.address,
                  postcode: request.postcode,
                },
              ]
            : [];
        })
        .sort((a, b) => +a.startAt - +b.startAt),
    };
  }),
  saveSettings: artisan
    .input(calendarSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        await requireArtisan(tx, ctx.user);
        await tx
          .update(s.settings)
          .set({
            calendarEnabled: input.enabled,
            calendarTimezone: input.timezone,
            weeklyWindows: input.weeklyWindows,
            travelZones: input.travelZones,
            bufferMinutes: input.bufferMinutes,
            horizonDays: input.horizonDays,
          })
          .where(eq(s.settings.id, 1));
        await recordAudit(
          tx,
          ctx.user.id,
          "calendar.settings.save.nonretroactive",
          "settings",
          1
        );
        return {
          success: true as const,
          message:
            "Paramètres enregistrés pour les nouvelles confirmations. Les rendez-vous existants et leurs marges restent inchangés.",
        };
      });
    }),
  savePeriod: artisan.input(periodInput).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    return db.transaction(async tx => {
      await principal(tx, true);
      await requireArtisan(tx, ctx.user);
      const ownerId = await workspaceOwnerId(tx, ctx.user);
      if (input.id) {
        const [existing] = await tx
          .select()
          .from(s.availability)
          .where(
            and(
              eq(s.availability.id, input.id),
              eq(s.availability.artisanUserId, ownerId)
            )
          );
        if (!existing) fail("Cette période n’est pas accessible.", "FORBIDDEN");
      }
      const range = {
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
      };
      if (input.kind === "blocked") {
        const appointments = await tx
          .select()
          .from(s.appointments)
          .where(inArray(s.appointments.status, [...busyStatuses]));
        if (appointments.some(a => overlaps(range, occupied(a))))
          fail(
            "Cette indisponibilité chevauche un rendez-vous confirmé ou ses marges. Annulez d’abord le rendez-vous depuis son dossier si nécessaire.",
            "CONFLICT"
          );
      }
      const values = {
        ...range,
        artisanUserId: ownerId,
        kind: input.kind,
        note: input.note || null,
      };
      let id = input.id;
      if (id)
        await tx
          .update(s.availability)
          .set(values)
          .where(
            and(
              eq(s.availability.id, id),
              eq(s.availability.artisanUserId, ownerId)
            )
          );
      else {
        const [created] = await tx
          .insert(s.availability)
          .values(values)
          .$returningId();
        id = created.id;
      }
      await recordAudit(
        tx,
        ctx.user.id,
        "calendar.period.save",
        "availability",
        id
      );
      return { success: true as const, id };
    });
  }),
  removePeriod: artisan.input(identifier).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    return db.transaction(async tx => {
      await principal(tx, true);
      await requireArtisan(tx, ctx.user);
      const ownerId = await workspaceOwnerId(tx, ctx.user);
      const [existing] = await tx
        .select()
        .from(s.availability)
        .where(
          and(
            eq(s.availability.id, input.id),
            eq(s.availability.artisanUserId, ownerId)
          )
        );
      if (!existing) fail("Cette période n’est pas accessible.", "FORBIDDEN");
      await tx
        .delete(s.availability)
        .where(
          and(
            eq(s.availability.id, input.id),
            eq(s.availability.artisanUserId, ownerId)
          )
        );
      await recordAudit(
        tx,
        ctx.user.id,
        "calendar.period.remove.nonretroactive",
        "availability",
        input.id
      );
      return { success: true as const };
    });
  }),
  deleteAppointment: artisan
    .input(identifier)
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      return db.transaction(async tx => {
        await principal(tx, true);
        await requireArtisan(tx, ctx.user);
        const [row] = await tx
          .select({ id: s.appointments.id })
          .from(s.appointments)
          .where(eq(s.appointments.id, input.id));
        if (!row) fail("Rendez-vous introuvable.", "NOT_FOUND");
        await tx.delete(s.appointments).where(eq(s.appointments.id, input.id));
        await recordAudit(
          tx,
          ctx.user.id,
          "calendar.appointment.delete",
          "appointment",
          row.id
        );
        return { success: true as const };
      });
    }),
  cleanCompletedAppointments: artisan.mutation(async ({ ctx }) => {
    const db = await dbRequired();
    return db.transaction(async tx => {
      await principal(tx, true);
      await requireArtisan(tx, ctx.user);
      const rows = await tx
        .select({ id: s.appointments.id })
        .from(s.appointments)
        .where(eq(s.appointments.status, "completed"));
      for (const r of rows) {
        await tx.delete(s.appointments).where(eq(s.appointments.id, r.id));
        await recordAudit(
          tx,
          ctx.user.id,
          "calendar.appointment.clean_completed",
          "appointment",
          r.id
        );
      }
      return { deleted: rows.length };
    });
  }),
  slots: procedure.input(slotsInput).query(async ({ input }) => {
    const db = await dbRequired();
    const row = await principal(db),
      config = configFrom(row);
    const empty = (reason: string) => ({
      configured: configured(config),
      slots: [] as { startAt: string; endAt: string }[],
      reason,
    });
    if (!configured(config))
      return empty(
        "Le calendrier public n’est pas activé ou configuré. MDS vous proposera un créneau."
      );
    const day = input.date.includes("-")
      ? input.date
      : `${input.date.slice(0, 4)}-${input.date.slice(4, 6)}-${input.date.slice(6, 8)}`;
    if (!validDay(day)) fail("La date demandée est invalide.");
    if (input.serviceId === null)
      return empty(
        "La durée de cette demande libre doit être évaluée par MDS, qui vous proposera un créneau."
      );
    const [service] = await db
      .select()
      .from(s.services)
      .where(
        and(
          eq(s.services.id, input.serviceId),
          eq(s.services.active, true),
          isNull(s.services.deletedAt)
        )
      );
    if (!service)
      return empty("Cette prestation n’est pas disponible. Contactez MDS.");
    if (
      !Number.isInteger(service.durationMinutes) ||
      service.durationMinutes < 1 ||
      service.durationMinutes > 1440
    )
      return empty(
        "MDS doit évaluer la durée de cette prestation avant de proposer un créneau."
      );
    if (
      input.durationMinutes !== undefined &&
      input.durationMinutes < service.durationMinutes
    )
      fail("La durée ne peut pas être inférieure à celle de la prestation.");
    const duration = input.durationMinutes ?? service.durationMinutes;
    if (zoneMinutes(config, input.postcode) === null)
      return empty(
        "Cette adresse n’est pas couverte par les zones du calendrier. Contactez MDS."
      );
    const now = new Date();
    if (
      day < parisDay(now) ||
      day > parisDay(new Date(+now + config.horizonDays * DAY))
    )
      return empty("Cette date est passée ou dépasse l’horizon du calendrier.");
    const current = await state(db, row);
    const slots: { startAt: string; endAt: string }[] = [];
    for (let minutes = 0; minutes < 1440 && slots.length < 12; minutes += 15) {
      const startAt = parisLocalToDate(
        day,
        `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
      );
      if (!startAt) continue;
      const endAt = new Date(+startAt + duration * MINUTE);
      if (
        !failureReason(
          config,
          current.periods,
          current.appointments,
          { startAt, endAt },
          input.postcode,
          now
        )
      )
        slots.push({
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });
    }
    return {
      configured: true,
      slots,
      reason: slots.length
        ? null
        : "Aucun créneau adapté ce jour. MDS peut vous proposer une autre date.",
    };
  }),
});
