import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

const boundary = vi.hoisted(() => ({ db: null as any }));
vi.mock("../db", () => ({ getDb: async () => boundary.db }));

import { mdsRouter } from "./router";
import { runAutomation } from "./automation";
import {
  MAX_LATE_HOURS,
  dispatchDueFollowUps,
  followUpDate,
  scheduleFollowUp,
  syncAssistantActions,
  unscheduleFollowUp,
} from "./followups";

const db = new MockDatabase();
boundary.db = db;
const now = new Date("2026-11-17T12:00:00Z");
const hours = (n: number) => n * 3600000;

function settings(patch: Record<string, unknown> = {}) {
  return {
    id: 1,
    artisanUserId: 1,
    proposalExpiryHours: 72,
    emailEnabled: true,
    emailFrom: "mds@example.test",
    smsEnabled: false,
    smsFrom: "",
    remindersEnabled: false,
    reminderHours: 24,
    proposalReminderHours: 6,
    trackingSecret: "a".repeat(64),
    publicOrigin: "",
    contactEmail: "",
    contactPhone: "",
    ...patch,
  };
}
function request(patch: Record<string, unknown> = {}) {
  return {
    id: 1,
    reference: "MDS-1",
    status: "awaiting_client",
    version: 0,
    quoteStatus: "none",
    expiresAt: null,
    proposedStart: null,
    ...patch,
  };
}
function action(patch: Record<string, unknown> = {}) {
  return {
    id: 1,
    requestId: 1,
    createdBy: 1,
    actionType: "follow_up",
    channel: "email",
    recipient: "client@example.test",
    subject: "Relance · MDS-1",
    body: "Bonjour, nous revenons vers vous.",
    status: "proposed",
    dedupeKey: "assistant:1:1:follow_up:email:1",
    lastError: null,
    scheduledFor: null,
    approvedAt: null,
    completedAt: null,
    ...patch,
  };
}
function scheduled(patch: Record<string, unknown> = {}) {
  return action({
    status: "scheduled",
    scheduledFor: new Date(now.getTime() - 60000),
    approvedAt: new Date(now.getTime() - hours(2)),
    ...patch,
  });
}
const rows = (table: any) => db.rows(table);
const auditActions = () => rows(s.audit).map(row => row.action);

beforeEach(() => {
  db.clear();
  db.put(s.settings, [settings()]);
  db.put(s.requests, [request()]);
  vi.stubEnv("MDS_RESEND_API_KEY", "test-resend-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("followUpDate : 9 h à Paris, hiver comme été", () => {
  const iso = (date: Date) => date.toISOString();
  it("demain à 9 h, heure d’hiver (UTC+1)", () => {
    expect(iso(followUpDate("tomorrow", now))).toBe("2026-11-18T08:00:00.000Z");
    expect(iso(followUpDate("three_days", now))).toBe("2026-11-20T08:00:00.000Z");
    expect(iso(followUpDate("one_week", now))).toBe("2026-11-24T08:00:00.000Z");
  });
  it("demain à 9 h, heure d’été (UTC+2)", () => {
    expect(
      iso(followUpDate("tomorrow", new Date("2026-07-01T12:00:00Z")))
    ).toBe("2026-07-02T07:00:00.000Z");
  });
  it("passage à l’heure d’été : le 29 mars 2026", () => {
    expect(
      iso(followUpDate("tomorrow", new Date("2026-03-28T10:00:00Z")))
    ).toBe("2026-03-29T07:00:00.000Z");
  });
  it("passage à l’heure d’hiver : le 25 octobre 2026", () => {
    // Le 24, il est encore UTC+2 ; à 9 h le 25 (après le changement à 3 h), UTC+1.
    expect(
      iso(followUpDate("tomorrow", new Date("2026-10-23T10:00:00Z")))
    ).toBe("2026-10-24T07:00:00.000Z");
    expect(
      iso(followUpDate("tomorrow", new Date("2026-10-24T10:00:00Z")))
    ).toBe("2026-10-25T08:00:00.000Z");
    expect(
      iso(followUpDate("three_days", new Date("2026-10-24T10:00:00Z")))
    ).toBe("2026-10-27T08:00:00.000Z");
  });
  it("utilise le jour de Paris, pas celui d’UTC, tard le soir", () => {
    // 23 h 30 UTC = 0 h 30 à Paris le 18 : « demain » est le 19.
    expect(
      iso(followUpDate("tomorrow", new Date("2026-11-17T23:30:00Z")))
    ).toBe("2026-11-19T08:00:00.000Z");
  });
  it("passe correctement la fin de mois et d’année", () => {
    expect(
      iso(followUpDate("one_week", new Date("2026-12-28T12:00:00Z")))
    ).toBe("2027-01-04T08:00:00.000Z");
  });
});

describe("programmation d’une relance", () => {
  const sendAt = new Date(now.getTime() + hours(21));
  it("programme sans rien envoyer et garde une trace", async () => {
    db.put(s.assistantActions, [action()]);
    const result = await scheduleFollowUp(db as any, {
      actionId: 1,
      sendAt,
      actorId: 1,
      now,
    });
    expect(result.status).toBe("scheduled");
    expect(rows(s.assistantActions)[0]).toMatchObject({
      status: "scheduled",
      scheduledFor: sendAt,
      approvedAt: now,
      completedAt: null,
      lastError: null,
    });
    expect(rows(s.messageOutbox)).toHaveLength(0);
    expect(auditActions()).toContain("assistant.followUp.schedule");
  });
  it("conserve le texte retouché par l’artisan, c’est lui qui partira", async () => {
    db.put(s.assistantActions, [action()]);
    await scheduleFollowUp(db as any, {
      actionId: 1,
      sendAt,
      actorId: 1,
      now,
      subject: "Objet retouché",
      body: "Message retouché par l’artisan.",
    });
    expect(rows(s.assistantActions)[0]).toMatchObject({
      status: "scheduled",
      subject: "Objet retouché",
      body: "Message retouché par l’artisan.",
    });
    await dispatchDueFollowUps(db as any, new Date(sendAt.getTime() + 1000), 1);
    expect(rows(s.messageOutbox)[0]).toMatchObject({
      subject: "Objet retouché",
      body: "Message retouché par l’artisan.",
    });
  });
  it("garde le brouillon d’origine quand rien n’est retouché", async () => {
    db.put(s.assistantActions, [action()]);
    await scheduleFollowUp(db as any, { actionId: 1, sendAt, actorId: 1, now });
    expect(rows(s.assistantActions)[0]).toMatchObject({
      subject: "Relance · MDS-1",
      body: "Bonjour, nous revenons vers vous.",
    });
  });
  it("refuse un moment passé, trop proche ou trop lointain", async () => {
    db.put(s.assistantActions, [action()]);
    const attempt = (when: Date) =>
      scheduleFollowUp(db as any, { actionId: 1, sendAt: when, actorId: 1, now });
    await expect(attempt(new Date(now.getTime() - 1000))).rejects.toThrow("à venir");
    await expect(attempt(new Date(now.getTime() + 2 * 60000))).rejects.toThrow("à venir");
    await expect(attempt(new Date(now.getTime() + 61 * 86400000))).rejects.toThrow("60 jours");
    await expect(attempt(new Date("invalid"))).rejects.toThrow("pas valide");
    expect(rows(s.assistantActions)[0].status).toBe("proposed");
  });
  it("refuse les appels, les autres types et les propositions déjà traitées", async () => {
    const attempt = () =>
      scheduleFollowUp(db as any, { actionId: 1, sendAt, actorId: 1, now });
    db.put(s.assistantActions, [action({ channel: "call" })]);
    await expect(attempt()).rejects.toThrow("appels");
    db.put(s.assistantActions, [action({ actionType: "quote_review" })]);
    await expect(attempt()).rejects.toThrow("relances client");
    db.put(s.assistantActions, [action({ status: "sent" })]);
    await expect(attempt()).rejects.toThrow("déjà été traitée");
    db.put(s.assistantActions, []);
    await expect(attempt()).rejects.toThrow("n’existe plus");
  });
  it.each(["paid", "closed", "cancelled", "refused"])(
    "refuse un dossier %s",
    async status => {
      db.put(s.requests, [request({ status })]);
      db.put(s.assistantActions, [action()]);
      await expect(
        scheduleFollowUp(db as any, { actionId: 1, sendAt, actorId: 1, now })
      ).rejects.toThrow("terminé ou clos");
      expect(rows(s.assistantActions)[0].status).toBe("proposed");
    }
  );
  it("autorise un dossier facturé mais impayé", async () => {
    db.put(s.requests, [request({ status: "invoiced" })]);
    db.put(s.assistantActions, [action()]);
    await expect(
      scheduleFollowUp(db as any, { actionId: 1, sendAt, actorId: 1, now })
    ).resolves.toMatchObject({ status: "scheduled" });
  });
  it("dédoublonne : une seule relance programmée par dossier et par canal", async () => {
    db.put(s.assistantActions, [
      action(),
      scheduled({ id: 2, dedupeKey: "other" }),
    ]);
    await expect(
      scheduleFollowUp(db as any, { actionId: 1, sendAt, actorId: 1, now })
    ).rejects.toThrow("déjà programmée");
    expect(rows(s.assistantActions)[0].status).toBe("proposed");
  });
  it("autorise un autre canal pour le même dossier", async () => {
    db.put(s.assistantActions, [
      action({ channel: "sms", recipient: "0601020304" }),
      scheduled({ id: 2, dedupeKey: "other" }),
    ]);
    await expect(
      scheduleFollowUp(db as any, { actionId: 1, sendAt, actorId: 1, now })
    ).resolves.toMatchObject({ status: "scheduled" });
  });
  it("deux programmations simultanées ne produisent qu’une relance", async () => {
    db.put(s.assistantActions, [
      action(),
      action({ id: 2, dedupeKey: "second" }),
    ]);
    const results = await Promise.allSettled(
      [1, 2].map(actionId =>
        scheduleFollowUp(db as any, { actionId, sendAt, actorId: 1, now })
      )
    );
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(
      rows(s.assistantActions).filter(row => row.status === "scheduled")
    ).toHaveLength(1);
  });
});

describe("annulation d’une relance programmée", () => {
  it("annule avant l’envoi et ne laisse rien partir", async () => {
    db.put(s.assistantActions, [scheduled({ scheduledFor: new Date(now.getTime() + hours(5)) })]);
    await unscheduleFollowUp(db as any, { actionId: 1, actorId: 1, now });
    expect(rows(s.assistantActions)[0]).toMatchObject({
      status: "cancelled",
      completedAt: now,
    });
    expect(rows(s.assistantActions)[0].lastError).toContain("Annulée");
    expect(auditActions()).toContain("assistant.followUp.unschedule");
    const totals = await dispatchDueFollowUps(db as any, new Date(now.getTime() + hours(10)), 1);
    expect(totals).toEqual({ queued: 0, failed: 0, cancelled: 0 });
    expect(rows(s.messageOutbox)).toHaveLength(0);
  });
  it("refuse d’annuler ce qui n’est plus programmé", async () => {
    db.put(s.assistantActions, [scheduled()]);
    await unscheduleFollowUp(db as any, { actionId: 1, actorId: 1, now });
    await expect(
      unscheduleFollowUp(db as any, { actionId: 1, actorId: 1, now })
    ).rejects.toThrow("plus programmée");
    db.put(s.assistantActions, [action({ status: "sent" })]);
    await expect(
      unscheduleFollowUp(db as any, { actionId: 1, actorId: 1, now })
    ).rejects.toThrow("plus programmée");
    expect(rows(s.assistantActions)[0].status).toBe("sent");
  });
});

describe("envoi à l’échéance", () => {
  it("ne touche à rien avant l’heure prévue", async () => {
    db.put(s.assistantActions, [
      scheduled({ scheduledFor: new Date(now.getTime() + 1000) }),
    ]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals).toEqual({ queued: 0, failed: 0, cancelled: 0 });
    expect(rows(s.assistantActions)[0].status).toBe("scheduled");
    expect(rows(s.messageOutbox)).toHaveLength(0);
  });
  it("met en file d’envoi à l’heure exacte, sans marquer « envoyée »", async () => {
    db.put(s.assistantActions, [scheduled({ scheduledFor: now })]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals).toEqual({ queued: 1, failed: 0, cancelled: 0 });
    expect(rows(s.messageOutbox)).toHaveLength(1);
    expect(rows(s.messageOutbox)[0]).toMatchObject({
      dedupeKey: "assistant-action:1",
      requestId: 1,
      channel: "email",
      recipient: "client@example.test",
      subject: "Relance · MDS-1",
      body: "Bonjour, nous revenons vers vous.",
      status: "queued",
      lastError: null,
    });
    expect(rows(s.assistantActions)[0]).toMatchObject({
      status: "approved",
      completedAt: null,
    });
    expect(auditActions()).toContain("assistant.followUp.dispatch");
  });
  it("un second passage ne renvoie rien", async () => {
    db.put(s.assistantActions, [scheduled()]);
    await dispatchDueFollowUps(db as any, now, 1);
    const again = await dispatchDueFollowUps(db as any, now, 1);
    expect(again).toEqual({ queued: 0, failed: 0, cancelled: 0 });
    expect(rows(s.messageOutbox)).toHaveLength(1);
  });
  it("ne duplique pas un message déjà en file pour cette action", async () => {
    db.put(s.assistantActions, [scheduled()]);
    db.put(s.messageOutbox, [
      {
        id: 1,
        dedupeKey: "assistant-action:1",
        requestId: 1,
        channel: "email",
        recipient: "client@example.test",
        subject: "Relance · MDS-1",
        body: "Bonjour",
        status: "queued",
      },
    ]);
    await dispatchDueFollowUps(db as any, now, 1);
    expect(rows(s.messageOutbox)).toHaveLength(1);
    expect(rows(s.assistantActions)[0].status).toBe("approved");
  });
  it("canal désactivé dans MDS : échec explicite, jamais « envoyée »", async () => {
    db.put(s.settings, [settings({ emailEnabled: false })]);
    db.put(s.assistantActions, [scheduled()]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals).toEqual({ queued: 0, failed: 1, cancelled: 0 });
    expect(rows(s.messageOutbox)[0]).toMatchObject({ status: "disabled" });
    expect(rows(s.assistantActions)[0]).toMatchObject({
      status: "failed",
      completedAt: now,
    });
    expect(rows(s.assistantActions)[0].lastError).toContain("non configuré");
  });
  it("fournisseur sans clé : échec explicite, jamais « envoyée »", async () => {
    vi.stubEnv("MDS_RESEND_API_KEY", "");
    db.put(s.assistantActions, [scheduled()]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals.failed).toBe(1);
    expect(rows(s.assistantActions)[0].status).toBe("failed");
  });
  it("SMS sans fournisseur configuré : échec explicite", async () => {
    db.put(s.assistantActions, [
      scheduled({ channel: "sms", recipient: "+33601020304" }),
    ]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals.failed).toBe(1);
    expect(rows(s.assistantActions)[0].status).toBe("failed");
  });
  it.each(["paid", "closed", "cancelled", "refused"])(
    "annule si le dossier est devenu %s depuis la programmation",
    async status => {
      db.put(s.requests, [request({ status })]);
      db.put(s.assistantActions, [scheduled()]);
      const totals = await dispatchDueFollowUps(db as any, now, 1);
      expect(totals).toEqual({ queued: 0, failed: 0, cancelled: 1 });
      expect(rows(s.messageOutbox)).toHaveLength(0);
      expect(rows(s.assistantActions)[0].status).toBe("cancelled");
      expect(rows(s.assistantActions)[0].lastError).toContain("terminé ou clos");
    }
  );
  it("annule si le dossier n’existe plus", async () => {
    db.put(s.requests, []);
    db.put(s.assistantActions, [scheduled()]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals.cancelled).toBe(1);
    expect(rows(s.messageOutbox)).toHaveLength(0);
  });
  it("annule plutôt que d’envoyer une relance en retard de plus de 24 h", async () => {
    db.put(s.assistantActions, [
      scheduled({
        scheduledFor: new Date(now.getTime() - hours(MAX_LATE_HOURS) - 1000),
      }),
    ]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals).toEqual({ queued: 0, failed: 0, cancelled: 1 });
    expect(rows(s.messageOutbox)).toHaveLength(0);
    expect(rows(s.assistantActions)[0].lastError).toContain("dépassée");
  });
  it("envoie encore une relance en retard de moins de 24 h", async () => {
    db.put(s.assistantActions, [
      scheduled({ scheduledFor: new Date(now.getTime() - hours(3)) }),
    ]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals.queued).toBe(1);
  });
  it("deux exécutions simultanées ne mettent la relance qu’une fois en file", async () => {
    db.put(s.assistantActions, [scheduled()]);
    const [a, b] = await Promise.all([
      dispatchDueFollowUps(db as any, now, 1),
      dispatchDueFollowUps(db as any, now, 1),
    ]);
    expect(a.queued + b.queued).toBe(1);
    expect(rows(s.messageOutbox)).toHaveLength(1);
    expect(rows(s.assistantActions)[0].status).toBe("approved");
  });
  it("traite chaque relance séparément", async () => {
    db.put(s.requests, [request(), request({ id: 2, reference: "MDS-2", status: "closed" })]);
    db.put(s.assistantActions, [
      scheduled(),
      scheduled({ id: 2, requestId: 2, dedupeKey: "two" }),
    ]);
    const totals = await dispatchDueFollowUps(db as any, now, 1);
    expect(totals).toEqual({ queued: 1, failed: 0, cancelled: 1 });
  });
});

describe("synchronisation avec la file d’envoi", () => {
  const outbox = (status: string, lastError: string | null = null) => [
    { id: 1, dedupeKey: "assistant-action:1", status, lastError },
  ];
  it.each(["accepted", "delivered"])(
    "message %s par le fournisseur : l’action devient envoyée",
    async status => {
      db.put(s.assistantActions, [action({ status: "approved" })]);
      db.put(s.messageOutbox, outbox(status));
      const result = await syncAssistantActions(db as any, now);
      expect(result).toEqual({ sent: 1, failed: 0 });
      expect(rows(s.assistantActions)[0]).toMatchObject({
        status: "sent",
        completedAt: now,
        lastError: null,
      });
    }
  );
  it("message refusé : l’action échoue avec le motif", async () => {
    db.put(s.assistantActions, [action({ status: "approved" })]);
    db.put(s.messageOutbox, outbox("failed", "Adresse refusée"));
    await syncAssistantActions(db as any, now);
    expect(rows(s.assistantActions)[0]).toMatchObject({
      status: "failed",
      lastError: "Adresse refusée",
    });
  });
  it("envoi incertain : jamais présenté comme envoyé", async () => {
    db.put(s.assistantActions, [action({ status: "approved" })]);
    db.put(s.messageOutbox, outbox("uncertain"));
    await syncAssistantActions(db as any, now);
    expect(rows(s.assistantActions)[0].status).toBe("failed");
    expect(rows(s.assistantActions)[0].lastError).toContain("confirmé");
  });
  it.each(["queued", "sending"])(
    "message encore %s : l’action reste en attente",
    async status => {
      db.put(s.assistantActions, [action({ status: "approved" })]);
      db.put(s.messageOutbox, outbox(status));
      const result = await syncAssistantActions(db as any, now);
      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(rows(s.assistantActions)[0].status).toBe("approved");
    }
  );
  it("ne modifie ni les brouillons ni les relances programmées", async () => {
    db.put(s.assistantActions, [
      action({ id: 1 }),
      scheduled({ id: 2, dedupeKey: "two" }),
    ]);
    db.put(s.messageOutbox, [
      { id: 1, dedupeKey: "assistant-action:1", status: "accepted" },
      { id: 2, dedupeKey: "assistant-action:2", status: "accepted" },
    ]);
    const result = await syncAssistantActions(db as any, now);
    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(rows(s.assistantActions).map(row => row.status)).toEqual([
      "proposed",
      "scheduled",
    ]);
  });
  it("est idempotent", async () => {
    db.put(s.assistantActions, [action({ status: "approved" })]);
    db.put(s.messageOutbox, outbox("accepted"));
    await syncAssistantActions(db as any, now);
    expect(await syncAssistantActions(db as any, now)).toEqual({ sent: 0, failed: 0 });
  });
});

describe("intégration avec l’automatisation", () => {
  it("une exécution manuelle traite les relances échues sans prétendre à un envoi", async () => {
    db.put(s.settings, [settings({ emailEnabled: false })]);
    db.put(s.assistantActions, [
      scheduled({ scheduledFor: new Date(Date.now() - 60000) }),
    ]);
    const result = await runAutomation(db as any, "manual", null, 1);
    expect(result.followUpsFailed).toBe(1);
    expect(result.followUpsQueued).toBe(0);
    expect(rows(s.assistantActions)[0].status).toBe("failed");
    expect(rows(s.assistantActions)[0].status).not.toBe("sent");
  });
  it("une relance dont le dossier est clos est annulée par l’automatisation", async () => {
    db.put(s.requests, [request({ status: "closed" })]);
    db.put(s.assistantActions, [
      scheduled({ scheduledFor: new Date(Date.now() - 60000) }),
    ]);
    const result = await runAutomation(db as any, "manual", null, 1);
    expect(result.followUpsCancelled).toBe(1);
    expect(rows(s.messageOutbox)).toHaveLength(0);
  });
  it("une relance future n’est pas touchée par l’automatisation", async () => {
    db.put(s.assistantActions, [
      scheduled({ scheduledFor: new Date(Date.now() + hours(5)) }),
    ]);
    const result = await runAutomation(db as any, "manual", null, 1);
    expect(result.followUpsQueued + result.followUpsFailed + result.followUpsCancelled).toBe(0);
    expect(rows(s.assistantActions)[0].status).toBe("scheduled");
  });
});

describe("accès : réservé à l’administrateur MDS", () => {
  const user = (id: number, role: "user" | "admin"): s.User => ({
    id,
    openId: `test-${id}`,
    role,
    name: `Test ${id}`,
    email: `u${id}@example.test`,
    loginMethod: "manus",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  });
  const caller = (u: s.User | null) =>
    mdsRouter.createCaller({
      user: u,
      req: { headers: {} } as any,
      res: { set: vi.fn() } as any,
    } as TrpcContext);
  beforeEach(() => {
    db.put(s.artisanTeam, [
      { id: 1, userId: 5, status: "active", displayName: "Collaborateur" },
    ]);
    db.put(s.assistantActions, [action()]);
  });
  it("l’administrateur programme à 9 h à Paris puis annule", async () => {
    const admin = caller(user(1, "admin"));
    const result = await admin.assistant.schedule({ actionId: 1, when: "tomorrow" });
    expect(result.status).toBe("scheduled");
    expect(result.note).toContain("Rien n’est envoyé avant");
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(result.scheduledFor);
    expect(hour).toBe("09");
    expect(result.scheduledFor.getTime()).toBeGreaterThan(Date.now());
    expect(rows(s.assistantActions)[0].status).toBe("scheduled");
    await admin.assistant.unschedule({ actionId: 1 });
    expect(rows(s.assistantActions)[0].status).toBe("cancelled");
  });
  it("un collaborateur actif ne peut ni programmer ni annuler", async () => {
    const collaborator = caller(user(5, "user"));
    await expect(
      collaborator.assistant.schedule({ actionId: 1, when: "tomorrow" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rows(s.assistantActions)[0].status).toBe("proposed");
    db.put(s.assistantActions, [scheduled()]);
    await expect(
      collaborator.assistant.unschedule({ actionId: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rows(s.assistantActions)[0].status).toBe("scheduled");
  });
  it("un utilisateur sans accès artisan est refusé, un visiteur aussi", async () => {
    await expect(
      caller(user(9, "user")).assistant.schedule({ actionId: 1, when: "tomorrow" })
    ).rejects.toThrow();
    await expect(
      caller(null).assistant.schedule({ actionId: 1, when: "tomorrow" })
    ).rejects.toThrow();
    expect(rows(s.assistantActions)[0].status).toBe("proposed");
  });
  it("la programmation depuis l’interface garde le texte retouché", async () => {
    const admin = caller(user(1, "admin"));
    await admin.assistant.schedule({
      actionId: 1,
      when: "three_days",
      subject: "  Objet corrigé  ",
      body: "Texte corrigé",
    });
    expect(rows(s.assistantActions)[0]).toMatchObject({
      status: "scheduled",
      subject: "Objet corrigé",
      body: "Texte corrigé",
    });
  });
  it("valider un envoi immédiat envoie le texte retouché, pas l’original", async () => {
    db.put(s.settings, [settings({ emailEnabled: false })]);
    const admin = caller(user(1, "admin"));
    const result = await admin.assistant.approve({
      actionId: 1,
      subject: "Objet retouché",
      body: "Message retouché",
    });
    // Canal non configuré : rien ne part, mais le texte conservé est bien celui relu.
    expect(result.status).toBe("failed");
    expect(rows(s.messageOutbox)[0]).toMatchObject({
      subject: "Objet retouché",
      body: "Message retouché",
      status: "disabled",
    });
    expect(rows(s.assistantActions)[0]).toMatchObject({
      subject: "Objet retouché",
      body: "Message retouché",
    });
  });
  it("valider sans retouche conserve le brouillon d’origine", async () => {
    db.put(s.settings, [settings({ emailEnabled: false })]);
    await caller(user(1, "admin")).assistant.approve({ actionId: 1 });
    expect(rows(s.messageOutbox)[0]).toMatchObject({
      subject: "Relance · MDS-1",
      body: "Bonjour, nous revenons vers vous.",
    });
  });
  it("une retouche vide est refusée au lieu d’être ignorée", async () => {
    const admin = caller(user(1, "admin"));
    await expect(
      admin.assistant.approve({ actionId: 1, body: "   " })
    ).rejects.toThrow();
    await expect(
      admin.assistant.schedule({ actionId: 1, when: "tomorrow", subject: "" })
    ).rejects.toThrow();
    expect(rows(s.assistantActions)[0].status).toBe("proposed");
    expect(rows(s.messageOutbox)).toHaveLength(0);
  });
  it("refuse un délai hors des choix proposés", async () => {
    await expect(
      caller(user(1, "admin")).assistant.schedule({ actionId: 1, when: "next_year" as any })
    ).rejects.toThrow();
  });
});
