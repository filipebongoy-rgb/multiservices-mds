import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { SignJWT } from "jose";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import { runAutomation, scheduledIdentity } from "./automation";
const db = new MockDatabase();
function request(patch: Record<string, unknown> = {}) {
  return {
    id: 1,
    reference: "MDS-unit",
    userId: null,
    organizationId: null,
    email: "client@example.test",
    phone: "+33601020304",
    idempotencyHash: "a".repeat(64),
    status: "awaiting_client",
    version: 0,
    quoteStatus: "none",
    expiresAt: new Date(Date.now() - 60000),
    proposedStart: null,
    ...patch,
  };
}
beforeEach(() => {
  db.clear();
  db.put(s.settings, [
    {
      id: 1,
      artisanUserId: 1,
      proposalExpiryHours: 72,
      emailEnabled: false,
      smsEnabled: false,
      remindersEnabled: false,
      reminderHours: 24,
      proposalReminderHours: 6,
      trackingSecret: "a".repeat(64),
      publicOrigin: "",
      contactEmail: "",
      contactPhone: "",
    },
  ]);
  vi.stubEnv("MANUS_JWT_SECRET", "unit-test-scheduler-secret-no-production");
  vi.stubEnv("MANUS_PROJECT_ID", "unit-test-project");
  vi.stubEnv("MANUS_OAUTH_API_URL", "https://oauth.example.test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function token(overrides: Record<string, unknown> = {}, expired = false) {
  return new SignJWT({
    openId: "cron_unit",
    appId: "unit-test-project",
    ...overrides,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 1 : "2h")
    .sign(new TextEncoder().encode(process.env.MANUS_JWT_SECRET));
}
describe("callback natif authentifié", () => {
  it("rejette un callback sans identité avant toute écriture", async () => {
    await expect(scheduledIdentity({ headers: {} })).rejects.toThrow("absente");
    expect(db.rows(s.automationRuns)).toHaveLength(0);
  });
  it.each([{ appId: "other-project" }, { openId: "user_123" }])(
    "vérifie projet et identité cron %j",
    async override => {
      const t = await token(override);
      await expect(
        scheduledIdentity({ headers: { cookie: "app_session_id=" + t } })
      ).rejects.toThrow("invalide");
    }
  );
  it("rejette un ticket expiré", async () => {
    const t = await token({}, true);
    await expect(
      scheduledIdentity({ headers: { cookie: "app_session_id=" + t } })
    ).rejects.toThrow();
  });
  it("utilise le taskUid résolu, pas un identifiant venant du corps", async () => {
    const t = await token();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              openId: "cron_unit",
              projectId: "unit-test-project",
              taskUid: "verified-task",
            })
          )
        )
    );
    expect(
      await scheduledIdentity({ headers: { cookie: "app_session_id=" + t } })
    ).toBe("verified-task");
  });
  it("une réponse OAuth d’un autre projet n’est pas une identité valide", async () => {
    const t = await token();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              openId: "cron_unit",
              projectId: "other",
              taskUid: "task",
            })
          )
        )
    );
    await expect(
      scheduledIdentity({ headers: { cookie: "app_session_id=" + t } })
    ).rejects.toThrow("non vérifiée");
  });
});
describe("maintenance idempotente en mémoire", () => {
  it("sans taskUid actif une tâche ne traite aucun dossier", async () => {
    db.put(s.requests, [request()]);
    await expect(
      runAutomation(db as any, "scheduled", "unknown", null)
    ).rejects.toThrow("pas activée");
    expect(db.rows(s.requests)[0].status).toBe("awaiting_client");
  });
  it("expiration sans visite client et sans création de rendez-vous", async () => {
    db.put(s.requests, [request()]);
    const r = await runAutomation(db as any, "manual", null, 1);
    expect(r.expired).toBe(1);
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "expired",
      version: 1,
      expiresAt: null,
    });
    expect(db.rows(s.events)).toHaveLength(1);
    expect(db.rows(s.appointments)).toHaveLength(0);
    expect(db.rows(s.audit).length).toBeGreaterThan(0);
  });
  it("une répétition planifiée ne produit pas deux expirations ou événements", async () => {
    const now = new Date();
    db.put(s.automationTasks, [
      { id: 1, taskUid: "verified-task", enabled: true },
    ]);
    db.put(s.requests, [request()]);
    await runAutomation(db as any, "scheduled", "verified-task", null, now);
    const again = await runAutomation(
      db as any,
      "scheduled",
      "verified-task",
      null,
      now
    );
    expect(again.duplicate).toBe(true);
    expect(db.rows(s.events)).toHaveLength(1);
    expect(db.rows(s.automationRuns)).toHaveLength(1);
  });
  it("rappel d’un rendez-vous confirmé n’altère pas la progression et ne se répète pas", async () => {
    db.rows(s.settings)[0].remindersEnabled = true;
    db.put(s.requests, [request({ status: "planned", expiresAt: null })]);
    db.put(s.appointments, [
      {
        id: 1,
        requestId: 1,
        status: "confirmed",
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
      },
    ]);
    await runAutomation(db as any, "manual", null, 1);
    await runAutomation(db as any, "manual", null, 1);
    expect(db.rows(s.reminders)).toHaveLength(1);
    expect(db.rows(s.events)).toHaveLength(1);
    expect(db.rows(s.requests)[0].status).toBe("planned");
    expect(db.rows(s.messageOutbox)).toHaveLength(0);
  });
  it("supplément expiré sans accord ne devient jamais exécutable", async () => {
    db.put(s.requests, [request({ status: "in_progress", expiresAt: null })]);
    db.put(s.extraWorks, [
      {
        id: 1,
        requestId: 1,
        status: "pending",
        version: 0,
        expiresAt: new Date(0),
      },
    ]);
    const r = await runAutomation(db as any, "manual", null, 1);
    expect(r.extrasExpired).toBe(1);
    expect(db.rows(s.extraWorks)[0].status).toBe("cancelled");
    expect(db.rows(s.requests)[0].status).toBe("in_progress");
  });
});

describe("déclencheur externe par secret (hébergement gratuit)", () => {
  const secret = "s".repeat(40);
  const bearer = (value: string) => ({ headers: { authorization: `Bearer ${value}` } });
  afterEach(() => vi.unstubAllEnvs());
  it("accepte le bon secret", async () => {
    vi.stubEnv("MDS_CRON_SECRET", secret);
    await expect(scheduledIdentity(bearer(secret))).resolves.toBe("external-cron");
  });
  it("refuse un mauvais secret, un secret de longueur différente et l’absence d’en-tête", async () => {
    vi.stubEnv("MDS_CRON_SECRET", secret);
    await expect(scheduledIdentity(bearer("x".repeat(40)))).rejects.toThrow();
    await expect(scheduledIdentity(bearer(secret + "x"))).rejects.toThrow();
    await expect(scheduledIdentity({ headers: {} })).rejects.toThrow();
    await expect(
      scheduledIdentity({ headers: { authorization: secret } })
    ).rejects.toThrow();
  });
  it("reste fermé tant que le secret est absent ou trop court", async () => {
    vi.stubEnv("MDS_CRON_SECRET", "");
    await expect(scheduledIdentity(bearer(""))).rejects.toThrow();
    vi.stubEnv("MDS_CRON_SECRET", "court");
    await expect(scheduledIdentity(bearer("court"))).rejects.toThrow();
  });
});
