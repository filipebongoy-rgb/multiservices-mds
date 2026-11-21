// Vérifie la migration PostgreSQL et le code des relances sur un VRAI
// PostgreSQL (PGlite, en mémoire) : contraintes, types, verrous, fuseaux.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getTableColumns, getTableName, eq, ilike, sql, count } from "drizzle-orm";
import * as s from "../../drizzle/schema";
import {
  dispatchDueFollowUps,
  scheduleFollowUp,
  syncAssistantActions,
  unscheduleFollowUp,
} from "./followups";

let client: PGlite;
let db: any;
const now = new Date("2026-11-17T12:00:00Z");

/** Remplit les colonnes obligatoires sans valeur par défaut. */
function filled(table: any, overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(getTableColumns(table)) as [string, any][]) {
    if (key in overrides) row[key] = overrides[key];
    else if (col.hasDefault || !col.notNull) continue;
    else if (col.enumValues) row[key] = col.enumValues[0];
    else {
      const kind = col.columnType as string;
      row[key] = kind.includes("Timestamp")
        ? new Date("2026-01-01T00:00:00Z")
        : kind.includes("Boolean")
          ? false
          : kind.includes("Date")
            ? "2026-01-01"
            : kind.includes("Json")
              ? []
              : kind.includes("Integer") || kind.includes("Serial")
                ? 1
                : "x";
    }
  }
  return row;
}

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle" });
  vi.stubEnv("MDS_RESEND_API_KEY", "test-resend-key");
}, 60000);
afterAll(async () => {
  vi.unstubAllEnvs();
  await client.close();
});

beforeEach(async () => {
  for (const t of [s.messageOutbox, s.assistantActions, s.audit, s.requests, s.clients, s.settings, s.users])
    await db.delete(t);
  await db.insert(s.users).values(filled(s.users, { id: 1, openId: "owner", role: "admin" }));
  await db.insert(s.settings).values(
    filled(s.settings, { id: 1, emailEnabled: true, emailFrom: "mds@example.test" })
  );
  await db.insert(s.clients).values(filled(s.clients, { id: 1 }));
  await db.insert(s.requests).values(
    filled(s.requests, { id: 1, reference: "MDS-1", status: "awaiting_client" })
  );
});

async function proposal(patch: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(s.assistantActions)
    .values(
      filled(s.assistantActions, {
        requestId: 1,
        createdBy: 1,
        actionType: "follow_up",
        channel: "email",
        recipient: "client@example.test",
        subject: "Relance · MDS-1",
        body: "Bonjour, nous revenons vers vous.",
        status: "proposed",
        dedupeKey: "k" + Math.random(),
        ...patch,
      })
    )
    .returning({ id: s.assistantActions.id });
  return row.id as number;
}
const one = async (table: any, id: number) =>
  (await db.select().from(table).where(eq(table.id, id)))[0];

describe("migration PostgreSQL", () => {
  it("crée les 45 tables et les 50 types énumérés", async () => {
    const tables = await client.query<{ n: number }>(
      "select count(*)::int n from information_schema.tables where table_schema='public' and table_name <> '__drizzle_migrations'"
    );
    const enums = await client.query<{ n: number }>(
      "select count(*)::int n from pg_type where typtype='e'"
    );
    expect(tables.rows[0].n).toBe(45);
    expect(enums.rows[0].n).toBe(50);
  });
  it("applique les contraintes : énumération, unicité et clé étrangère", async () => {
    await expect(
      db.insert(s.users).values(filled(s.users, { openId: "x", role: "pirate" }))
    ).rejects.toThrow();
    await expect(
      db.insert(s.users).values(filled(s.users, { openId: "owner" }))
    ).rejects.toThrow();
    await expect(
      db.insert(s.assistantActions).values(
        filled(s.assistantActions, { requestId: 999, createdBy: 1, dedupeKey: "fk" })
      )
    ).rejects.toThrow();
  });
});

describe("comportements PostgreSQL du code", () => {
  it("insert … returning donne l’identifiant, et l’upsert fonctionne", async () => {
    const [created] = await db
      .insert(s.users)
      .values(filled(s.users, { openId: "u2", name: "Avant" }))
      .returning({ id: s.users.id });
    expect(created.id).toBeGreaterThan(1);
    await db
      .insert(s.users)
      .values(filled(s.users, { openId: "u2", name: "Après" }))
      .onConflictDoUpdate({ target: s.users.openId, set: { name: "Après" } });
    const rows = await db.select().from(s.users).where(eq(s.users.openId, "u2"));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Après");
  });
  it("updatedAt est renseigné par l’application à chaque mise à jour", async () => {
    const [before] = await db.select().from(s.users).where(eq(s.users.id, 1));
    await new Promise(r => setTimeout(r, 15));
    await db.update(s.users).set({ name: "Nouveau" }).where(eq(s.users.id, 1));
    const [after] = await db.select().from(s.users).where(eq(s.users.id, 1));
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });
  it("count(*)::int renvoie un nombre, et ilike ignore la casse", async () => {
    const [total] = await db.select({ total: sql<number>`count(*)::int` }).from(s.users);
    expect(typeof total.total).toBe("number");
    const [helper] = await db.select({ total: count() }).from(s.users);
    expect(typeof helper.total).toBe("number");
    await db.update(s.users).set({ name: "Françoise Dupont" }).where(eq(s.users.id, 1));
    const found = await db.select().from(s.users).where(ilike(s.users.name, "%dupont%"));
    expect(found).toHaveLength(1);
  });
  it("les horodatages et le JSON font l’aller-retour sans décalage", async () => {
    const at = new Date("2026-03-29T07:00:00.000Z");
    const id = await proposal({ scheduledFor: at });
    expect((await one(s.assistantActions, id)).scheduledFor.toISOString()).toBe(at.toISOString());
    const rows = await db.select().from(s.services).limit(1);
    expect(rows).toEqual([]);
    const [svc] = await db
      .insert(s.services)
      .values(filled(s.services, { questions: [{ q: "a" }], problemTypes: ["x"], active: true }))
      .returning({ id: s.services.id });
    const stored = await one(s.services, svc.id);
    expect(stored.questions).toEqual([{ q: "a" }]);
    expect(stored.active).toBe(true);
  });
});

describe("relances sur PostgreSQL réel", () => {
  const sendAt = new Date(now.getTime() + 21 * 3600000);
  it("programme, met en file, puis ne passe « envoyée » qu’après acceptation", async () => {
    const id = await proposal();
    await scheduleFollowUp(db, { actionId: id, sendAt, actorId: 1, now, subject: "Objet retouché" });
    let row = await one(s.assistantActions, id);
    expect(row.status).toBe("scheduled");
    expect(row.subject).toBe("Objet retouché");
    expect(row.scheduledFor.toISOString()).toBe(sendAt.toISOString());

    expect(await dispatchDueFollowUps(db, new Date(sendAt.getTime() - 1000), 1)).toEqual({
      queued: 0, failed: 0, cancelled: 0,
    });
    const due = new Date(sendAt.getTime() + 1000);
    expect(await dispatchDueFollowUps(db, due, 1)).toEqual({ queued: 1, failed: 0, cancelled: 0 });
    expect(await dispatchDueFollowUps(db, due, 1)).toEqual({ queued: 0, failed: 0, cancelled: 0 });
    const outbox = await db.select().from(s.messageOutbox);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ dedupeKey: `assistant-action:${id}`, status: "queued", subject: "Objet retouché" });
    row = await one(s.assistantActions, id);
    expect(row.status).toBe("approved");

    expect(await syncAssistantActions(db, due)).toEqual({ sent: 0, failed: 0 });
    await db.update(s.messageOutbox).set({ status: "accepted" });
    expect(await syncAssistantActions(db, due)).toEqual({ sent: 1, failed: 0 });
    expect((await one(s.assistantActions, id)).status).toBe("sent");
  });
  it("refuse une seconde relance programmée sur le même dossier et canal", async () => {
    const first = await proposal();
    const second = await proposal();
    await scheduleFollowUp(db, { actionId: first, sendAt, actorId: 1, now });
    await expect(scheduleFollowUp(db, { actionId: second, sendAt, actorId: 1, now })).rejects.toThrow("déjà programmée");
    expect((await one(s.assistantActions, second)).status).toBe("proposed");
  });
  it("annule sans rien envoyer, et refuse d’annuler deux fois", async () => {
    const id = await proposal();
    await scheduleFollowUp(db, { actionId: id, sendAt, actorId: 1, now });
    await unscheduleFollowUp(db, { actionId: id, actorId: 1, now });
    expect((await one(s.assistantActions, id)).status).toBe("cancelled");
    await expect(unscheduleFollowUp(db, { actionId: id, actorId: 1, now })).rejects.toThrow("plus programmée");
    await dispatchDueFollowUps(db, new Date(sendAt.getTime() + 1000), 1);
    expect(await db.select().from(s.messageOutbox)).toHaveLength(0);
  });
  it("annule à l’échéance si le dossier est clos, sans écrire dans la file", async () => {
    const id = await proposal();
    await scheduleFollowUp(db, { actionId: id, sendAt, actorId: 1, now });
    await db.update(s.requests).set({ status: "closed" }).where(eq(s.requests.id, 1));
    expect(await dispatchDueFollowUps(db, new Date(sendAt.getTime() + 1000), 1)).toEqual({
      queued: 0, failed: 0, cancelled: 1,
    });
    expect(await db.select().from(s.messageOutbox)).toHaveLength(0);
    expect((await one(s.assistantActions, id)).lastError).toContain("terminé ou clos");
  });
  it("canal désactivé : échec explicite, jamais « envoyée »", async () => {
    await db.update(s.settings).set({ emailEnabled: false }).where(eq(s.settings.id, 1));
    const id = await proposal();
    await scheduleFollowUp(db, { actionId: id, sendAt, actorId: 1, now });
    await dispatchDueFollowUps(db, new Date(sendAt.getTime() + 1000), 1);
    const row = await one(s.assistantActions, id);
    expect(row.status).toBe("failed");
    expect(row.lastError).toContain("non configuré");
  });
  it("une transaction en échec annule tout (rollback réel)", async () => {
    const id = await proposal();
    await expect(
      db.transaction(async (tx: any) => {
        await tx.update(s.assistantActions).set({ status: "cancelled" }).where(eq(s.assistantActions.id, id));
        throw new Error("panne");
      })
    ).rejects.toThrow("panne");
    expect((await one(s.assistantActions, id)).status).toBe("proposed");
  });
});

it("nomme bien ses tables", () => {
  expect(getTableName(s.assistantActions)).toBe("mds_assistant_actions");
});
