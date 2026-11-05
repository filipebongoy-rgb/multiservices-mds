import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import type { Database, SqlDb } from "./common";
import type { TrpcContext } from "../_core/context";
const boundary = vi.hoisted(() => ({ db: null as Database | null }));
vi.mock("../db", () => ({ getDb: async () => boundary.db }));
import { calendarRouter, checkCalendar, parisLocalToDate } from "./calendar";
import { principal } from "./common";
const db = new MockDatabase();
const user = (id: number, role: "user" | "admin" = "user"): s.User => ({
  id,
  role,
  openId: `calendar-test-${id}`,
  name: "Test",
  email: "calendar@example.test",
  loginMethod: "manus",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
});
const ctx = (u: s.User | null): TrpcContext => ({
  user: u,
  req: { headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});
const caller = (u: s.User | null = null) => calendarRouter.createCaller(ctx(u));
const artisan = () => caller(user(1, "admin"));
const base = () => ({
  id: 1,
  artisanUserId: 1,
  legalNotice: "",
  calendarEnabled: true,
  calendarTimezone: "Europe/Paris",
  weeklyWindows: [
    { weekday: 1, start: "09:00", end: "12:00" },
    { weekday: 1, start: "14:00", end: "18:00" },
  ],
  travelZones: [
    { prefix: "75", travelMinutes: 20 },
    { prefix: "75001", travelMinutes: 30 },
  ],
  bufferMinutes: 10,
  horizonDays: 90,
});
const range = (start: string, end: string) => ({
  startAt: new Date(`2030-01-07T${start}:00Z`),
  endAt: new Date(`2030-01-07T${end}:00Z`),
});
const check = (times: { startAt: Date; endAt: Date }, postcode = "75002") =>
  db.transaction(async tx => {
    await principal(tx as SqlDb, true);
    return checkCalendar(tx as SqlDb, times, { id: 1, postcode });
  });
const query = (
  patch: Partial<{
    serviceId: number | null;
    postcode: string;
    date: string;
    durationMinutes: number;
  }> = {}
) =>
  caller().slots({
    serviceId: 1,
    postcode: "75002",
    date: "2030-01-07",
    ...patch,
  });
const period = (
  kind: "blocked" | "available",
  start: string,
  end: string,
  patch = {}
) => ({
  id: 1,
  artisanUserId: 1,
  kind,
  ...range(start, end),
  note: "Note privée",
  ...patch,
});
const appointment = (start: string, end: string, patch = {}) => ({
  id: 1,
  requestId: 7,
  status: "confirmed",
  ...range(start, end),
  travelMinutes: 20,
  bufferMinutes: 10,
  ...patch,
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-01-01T10:00:00Z"));
  db.clear();
  boundary.db = db as unknown as Database;
  db.put(s.settings, [base()]);
  db.put(s.services, [
    { id: 1, active: true, deletedAt: null, durationMinutes: 60 },
  ]);
});
afterEach(() => vi.useRealTimers());
describe("créneaux publics réels et confidentialité", () => {
  it("respecte matin/soir, trajet, marge, pas de midi et maximum 12 sans réservation", async () => {
    const result = await query();
    expect(result.configured).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.slots).toHaveLength(12);
    expect(result.slots.map(slot => slot.startAt)).toMatchInlineSnapshot(`
      [
        "2030-01-07T08:30:00.000Z",
        "2030-01-07T08:45:00.000Z",
        "2030-01-07T09:00:00.000Z",
        "2030-01-07T09:15:00.000Z",
        "2030-01-07T09:30:00.000Z",
        "2030-01-07T09:45:00.000Z",
        "2030-01-07T13:30:00.000Z",
        "2030-01-07T13:45:00.000Z",
        "2030-01-07T14:00:00.000Z",
        "2030-01-07T14:15:00.000Z",
        "2030-01-07T14:30:00.000Z",
        "2030-01-07T14:45:00.000Z",
      ]
    `);
    expect(db.rows(s.appointments)).toHaveLength(0);
    expect(db.operations.every(o => o.operation === "select")).toBe(true);
    expect(Object.keys(result)).toEqual(["configured", "slots", "reason"]);
    expect(Object.keys(result.slots[0])).toEqual(["startAt", "endAt"]);
  });
  it("ne crée aucune heure par défaut et calendrier désactivé ne propose rien", async () => {
    db.put(s.settings, [
      { ...base(), calendarEnabled: false, weeklyWindows: [], travelZones: [] },
    ]);
    expect(await query()).toMatchObject({ configured: false, slots: [] });
    expect(await check(range("22:00", "23:00"), "99999")).toEqual({
      travelMinutes: 0,
      bufferMinutes: 0,
    });
  });
  it("durée inconnue sur demande libre : MDS propose, pas de faux 15 minutes", async () => {
    const result = await query({ serviceId: null, durationMinutes: 15 });
    expect(result.slots).toEqual([]);
    expect(result.reason).toContain("MDS");
  });
  it("catalogue inactif/supprimé invisible et durée raccourcie rejetée", async () => {
    await expect(query({ durationMinutes: 15 })).rejects.toThrow("durée");
    db.put(s.services, [
      { id: 1, active: false, deletedAt: null, durationMinutes: 60 },
    ]);
    expect((await query()).slots).toEqual([]);
    db.put(s.services, [
      { id: 1, active: true, deletedAt: new Date(), durationMinutes: 60 },
    ]);
    expect((await query()).slots).toEqual([]);
  });
  it("dates calendaires invalides rejetées, dates passées/hors horizon sans créneau", async () => {
    await expect(query({ date: "2030-02-30" })).rejects.toThrow("date");
    expect((await query({ date: "20291231" })).slots).toEqual([]);
    expect((await query({ date: "2030-12-30" })).slots).toEqual([]);
  });
  it("futur uniquement avec pas de 15 minutes", async () => {
    vi.setSystemTime(new Date("2030-01-07T09:02:00Z"));
    const result = await query();
    expect(result.slots[0].startAt).toBe("2030-01-07T09:30:00.000Z");
  });
});
describe("contrôle transactionnel et occupation", () => {
  it("préfixe postal le plus long et hors-zone rejetée", async () => {
    expect(await check(range("09:00", "10:00"), "75001")).toEqual({
      travelMinutes: 30,
      bufferMinutes: 10,
    });
    expect(await check(range("09:00", "10:00"))).toEqual({
      travelMinutes: 20,
      bufferMinutes: 10,
    });
    await expect(check(range("09:00", "10:00"), "69001")).rejects.toThrow(
      "zones"
    );
  });
  it("déplacement avant et buffer après doivent tenir dans les fenêtres", async () => {
    await expect(check(range("08:00", "09:00"))).rejects.toThrow("horaires");
    await expect(check(range("10:00", "11:00"))).rejects.toThrow("horaires");
    await expect(check(range("11:00", "12:00"))).rejects.toThrow("horaires");
    expect(await check(range("13:30", "14:30"))).toEqual({
      travelMinutes: 20,
      bufferMinutes: 10,
    });
  });
  it("available explicite ouvre hors horaires, blocked a priorité", async () => {
    db.put(s.availability, [period("available", "11:00", "13:00")]);
    expect(await check(range("11:30", "12:30"))).toEqual({
      travelMinutes: 20,
      bufferMinutes: 10,
    });
    db.put(s.availability, [
      period("available", "11:00", "13:00"),
      period("blocked", "12:00", "12:15", { id: 2 }),
    ]);
    await expect(check(range("11:30", "12:30"))).rejects.toThrow(
      "indisponibilité"
    );
  });
  it("marges des deux rendez-vous se cumulent, bord exact libre, snapshots conservés", async () => {
    db.put(s.appointments, [appointment("08:30", "09:30")]);
    await expect(check(range("09:45", "10:45"))).rejects.toThrow("rendez-vous");
    expect(await check(range("10:00", "10:45"))).toEqual({
      travelMinutes: 20,
      bufferMinutes: 10,
    });
    expect(db.rows(s.appointments)[0]).toMatchObject({
      travelMinutes: 20,
      bufferMinutes: 10,
    });
  });
  it("confirmed/en cours/terminé occupent mais annulé ne bloque pas", async () => {
    for (const status of ["confirmed", "in_progress", "completed"]) {
      db.put(s.appointments, [appointment("08:30", "09:30", { status })]);
      await expect(check(range("09:00", "10:00"))).rejects.toThrow("conflit");
    }
    db.put(s.appointments, [
      appointment("08:30", "09:30", { status: "cancelled" }),
    ]);
    expect(await check(range("09:00", "10:00"))).toMatchObject({
      travelMinutes: 20,
    });
  });
  it("ancien calendrier désactivé conserve conflits et blocs sans revendiquer de zone", async () => {
    db.put(s.settings, [{ ...base(), calendarEnabled: false }]);
    db.put(s.appointments, [
      appointment("08:30", "09:30", { travelMinutes: 0, bufferMinutes: 0 }),
    ]);
    await expect(check(range("09:00", "10:00"), "99999")).rejects.toThrow(
      "conflit"
    );
    db.put(s.availability, [period("blocked", "10:00", "12:00")]);
    await expect(check(range("10:30", "11:30"), "99999")).rejects.toThrow(
      "conflit"
    );
  });
  it("anciens rendez-vous à marge zéro ne reçoivent pas une nouvelle marge rétroactive", async () => {
    db.put(s.appointments, [
      appointment("08:30", "09:30", { travelMinutes: 0, bufferMinutes: 0 }),
    ]);
    expect(await check(range("09:50", "10:45"))).toEqual({
      travelMinutes: 20,
      bufferMinutes: 10,
    });
  });
  it("bloque passé, horizon, durée invalide sans insérer quoi que ce soit", async () => {
    await expect(
      check({ startAt: new Date("2029-12-31"), endAt: new Date("2030-01-01") })
    ).rejects.toThrow("passé");
    await expect(
      check({
        startAt: new Date("2031-01-01"),
        endAt: new Date("2031-01-01T01:00Z"),
      })
    ).rejects.toThrow("horizon");
    await expect(check(range("10:00", "09:00"))).rejects.toThrow("durée");
    expect(db.rows(s.appointments)).toEqual([]);
  });
});
describe("administration sûre", () => {
  it("lecture et écritures artisan uniquement", async () => {
    await expect(caller().get()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(user(2)).get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller(user(2, "admin")).get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    db.put(s.availability, [
      period("available", "11:00", "13:00"),
      period("blocked", "10:00", "11:00", { id: 2, artisanUserId: 9 }),
    ]);
    db.put(s.requests, [
      {
        id: 7,
        reference: "MDS-test",
        name: "Test",
        address: "Adresse test",
        postcode: "75001",
        email: "secret@example.test",
        trackingHash: "never-public",
      },
    ]);
    db.put(s.appointments, [appointment("08:30", "09:30")]);
    const result = await artisan().get();
    expect(result.periods).toHaveLength(1);
    expect(Object.keys(result.appointments[0])).toEqual([
      "id",
      "requestId",
      "startAt",
      "endAt",
      "status",
      "travelMinutes",
      "bufferMinutes",
      "reference",
      "name",
      "address",
      "postcode",
    ]);
    expect(JSON.stringify(result)).not.toContain("never-public");
  });
  it("settings exigent horaires ET zones pour activer et ne modifient pas les confirmations", async () => {
    const settings = {
      enabled: true,
      timezone: "Europe/Paris" as const,
      weeklyWindows: base().weeklyWindows,
      travelZones: base().travelZones,
      bufferMinutes: 30,
      horizonDays: 90,
    };
    await expect(
      artisan().saveSettings({ ...settings, weeklyWindows: [] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      artisan().saveSettings({ ...settings, travelZones: [] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    db.put(s.appointments, [appointment("08:30", "09:30")]);
    await artisan().saveSettings(settings);
    expect(db.rows(s.appointments)[0]).toMatchObject({
      status: "confirmed",
      travelMinutes: 20,
      bufferMinutes: 10,
    });
    expect(db.rows(s.audit)[0].action).toContain("nonretroactive");
  });
  it("bloquer une occupation ou ses marges exige annuler d’abord, aucun cancel silencieux", async () => {
    db.put(s.appointments, [appointment("08:30", "09:30")]);
    await expect(
      artisan().savePeriod({
        ...rangeStrings("09:35", "09:45"),
        kind: "blocked",
        note: "Congé",
      })
    ).rejects.toThrow("Annulez d’abord");
    expect(db.rows(s.availability)).toEqual([]);
    expect(db.rows(s.appointments)[0].status).toBe("confirmed");
    await artisan().savePeriod({
      ...rangeStrings("09:40", "09:45"),
      kind: "blocked",
      note: "Congé",
    });
    expect(db.rows(s.availability)).toHaveLength(1);
    expect(
      db.operations.some(o => o.locked && o.table === "mds_settings")
    ).toBe(true);
  });
  it("périodes croissantes, limite raisonnable et owner sur modifier/supprimer", async () => {
    await expect(
      artisan().savePeriod({
        ...rangeStrings("10:00", "09:00"),
        kind: "blocked",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      artisan().savePeriod({
        startAt: "2030-01-01T00:00:00Z",
        endAt: "2032-01-01T00:00:00Z",
        kind: "blocked",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    db.put(s.availability, [
      period("blocked", "11:00", "13:00", { artisanUserId: 9 }),
    ]);
    await expect(
      artisan().savePeriod({
        id: 1,
        ...rangeStrings("11:00", "12:00"),
        kind: "available",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(artisan().removePeriod({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.rows(s.availability)[0].artisanUserId).toBe(9);
  });
  it("création modification suppression owner réelles et journalisées", async () => {
    const created = await artisan().savePeriod({
      ...rangeStrings("11:00", "12:00"),
      kind: "available",
      note: "Ouverture",
    });
    await artisan().savePeriod({
      id: created.id,
      ...rangeStrings("11:00", "13:00"),
      kind: "available",
      note: "Modifiée",
    });
    expect(db.rows(s.availability)[0].note).toBe("Modifiée");
    await artisan().removePeriod({ id: created.id });
    expect(db.rows(s.availability)).toEqual([]);
    expect(db.rows(s.audit)).toHaveLength(3);
  });
});
function rangeStrings(start: string, end: string) {
  const times = range(start, end);
  return {
    startAt: times.startAt.toISOString(),
    endAt: times.endAt.toISOString(),
  };
}
describe("Paris et changements d’heure", () => {
  it("conversion été/hiver sans dépendre du fuseau du serveur", () => {
    expect(parisLocalToDate("2030-01-07", "09:00")?.toISOString()).toBe(
      "2030-01-07T08:00:00.000Z"
    );
    expect(parisLocalToDate("2030-07-01", "09:00")?.toISOString()).toBe(
      "2030-07-01T07:00:00.000Z"
    );
  });
  it("heure inexistante ou ambiguë refusée, dates impossibles aussi", () => {
    expect(parisLocalToDate("2030-03-31", "02:30")).toBeNull();
    expect(parisLocalToDate("2030-10-27", "02:30")).toBeNull();
    expect(parisLocalToDate("2030-02-30", "09:00")).toBeNull();
    expect(parisLocalToDate("2030-10-27", "03:30")?.toISOString()).toBe(
      "2030-10-27T02:30:00.000Z"
    );
  });
  it("confirmation refuse un UTC correspondant à l’heure locale ambiguë", async () => {
    vi.setSystemTime(new Date("2030-10-01T10:00:00Z"));
    db.put(s.settings, [
      {
        ...base(),
        weeklyWindows: [{ weekday: 7, start: "00:00", end: "05:00" }],
      },
    ]);
    await expect(
      check({
        startAt: new Date("2030-10-27T00:30:00Z"),
        endAt: new Date("2030-10-27T02:30:00Z"),
      })
    ).rejects.toThrow("ambiguë");
  });
});

describe("concurrence sérialisée et propositions non réservées", () => {
  it("deux confirmations concurrentes sous le verrou unique : une seule occupation", async () => {
    const confirm = (id: number) =>
      db.transaction(async tx => {
        await principal(tx as SqlDb, true);
        const times = range("09:00", "10:00");
        const margins = await checkCalendar(tx as SqlDb, times, {
          id,
          postcode: "75002",
        });
        await tx
          .insert(s.appointments)
          .values({ requestId: id, ...times, ...margins, status: "confirmed" });
      });
    const results = await Promise.allSettled([confirm(1), confirm(2)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(db.rows(s.appointments)).toHaveLength(1);
    expect(db.rows(s.appointments)[0]).toMatchObject({
      travelMinutes: 20,
      bufferMinutes: 10,
    });
  });
  it("deux propositions identiques vérifiées ne réservent rien", async () => {
    expect(await check(range("09:00", "10:00"))).toEqual(
      await check(range("09:00", "10:00"))
    );
    expect(db.rows(s.appointments)).toEqual([]);
    expect(
      (await query()).slots.some(
        slot => slot.startAt === "2030-01-07T09:00:00.000Z"
      )
    ).toBe(true);
  });
  it("requête publique enlève les conflits réels sans divulguer données privées", async () => {
    db.put(s.appointments, [appointment("08:30", "09:00")]);
    db.put(s.availability, [
      period("blocked", "13:00", "18:00", { note: "Congé privé médical" }),
    ]);
    const result = await query();
    expect(result.slots.map(slot => slot.startAt)).toEqual([
      "2030-01-07T09:30:00.000Z",
      "2030-01-07T09:45:00.000Z",
    ]);
    expect(JSON.stringify(result)).not.toContain("médical");
    expect(JSON.stringify(result)).not.toContain("requestId");
    expect(db.rows(s.appointments)).toHaveLength(1);
  });
  it("ouverture explicite d’un jour sans horaires et blocage prioritaire dans slots", async () => {
    db.put(s.availability, [
      {
        id: 1,
        artisanUserId: 1,
        kind: "available",
        startAt: new Date("2030-01-08T08:00:00Z"),
        endAt: new Date("2030-01-08T11:00:00Z"),
        note: "Ouverture réelle",
      },
    ]);
    const result = await query({ date: "2030-01-08" });
    expect(result.slots[0].startAt).toBe("2030-01-08T08:30:00.000Z");
    db.rows(s.availability).push({
      id: 2,
      artisanUserId: 1,
      kind: "blocked",
      startAt: new Date("2030-01-08T08:00:00Z"),
      endAt: new Date("2030-01-08T11:00:00Z"),
      note: "Congé réel",
    });
    expect((await query({ date: "2030-01-08" })).slots).toEqual([]);
  });
});
