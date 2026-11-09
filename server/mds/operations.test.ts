import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import { router } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import { hash } from "./common";
const boundary = vi.hoisted(() => ({ db: null as any }));
vi.mock("../db", () => ({ getDb: async () => boundary.db }));
import { requestsRouter, expireRequest } from "./requests";
import { operationsRouter } from "./operations";
import { assistantRouter } from "./assistant";
const app = router({ requests: requestsRouter, operations: operationsRouter, assistant: assistantRouter });
const db = new MockDatabase();
const token = "memory-only-private-track-key";
const future = "2030-01-02T10:00:00Z";
const alternate = "2030-01-03T10:00:00Z";
const user = (id: number, role: "user" | "admin" = "user"): s.User => ({
  id,
  role,
  openId: `memory-${id}`,
  name: "Test",
  email: `user${id}@example.test`,
  loginMethod: "manus",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
});
const caller = (identity: s.User | null = null) =>
  app.createCaller({
    user: identity,
    req: { headers: {} },
    res: { set: vi.fn() },
  } as unknown as TrpcContext);
const owner = () => caller(user(1, "admin"));
const client = () => caller(user(2));
function request(id = 1, patch: Partial<s.MdsRequest> = {}): s.MdsRequest {
  return {
    id,
    reference: `MDS-memory-${id}`,
    trackingHash: hash(token),
    idempotencyHash: `memory-idem-${id}`,
    payloadHash: "memory",
    userId: 2,
    clientId: id,
    serviceId: null,
    serviceName: null,
    description: "Besoin de travaux pour le test",
    problemType: "",
    name: "Client test",
    email: "test@example.test",
    phone: "0102030405",
    address: "1 rue du test",
    postcode: "75001",
    city: "Paris",
    desiredStart: new Date(future),
    organizationId: null,
    siteId: null,
    pricingSnapshot: null,
    alternatives: [],
    departedAt: null,
    answers: {},
    consentAt: new Date(),
    status: "planned",
    version: 0,
    proposedStart: new Date(future),
    proposedPriceCents: 12000,
    durationMinutes: 60,
    proposalMessage: null,
    expiresAt: null,
    quoteStatus: "none",
    lastAction: null,
    lastActionVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...patch,
  };
}
const extra = (patch: Record<string, unknown> = {}) => ({
  id: 1,
  requestId: 1,
  scope: "Remplacement du flexible détérioré",
  amountCents: 3000,
  durationMinutes: 20,
  conditions: "Flexible compris, autres pièces exclues",
  documentId: null,
  status: "pending",
  version: 0,
  expiresAt: new Date("2030-02-01"),
  acceptedAt: null,
  startedAt: null,
  completedAt: null,
  ...patch,
});
function active() {
  db.put(s.appointments, [
    {
      id: 1,
      requestId: 1,
      startAt: new Date(future),
      endAt: new Date("2030-01-02T11:00:00Z"),
      status: "confirmed",
      travelMinutes: 0,
      bufferMinutes: 0,
    },
  ]);
  db.put(s.interventions, [
    {
      id: 1,
      requestId: 1,
      appointmentId: 1,
      startedAt: null,
      completedAt: null,
    },
  ]);
}
function running() {
  db.put(s.requests, [request(1, { status: "in_progress" })]);
  active();
  db.put(s.interventions, [
    {
      id: 1,
      requestId: 1,
      appointmentId: 1,
      startedAt: new Date(),
      completedAt: null,
    },
  ]);
  db.put(s.documents, [
    { id: 99, requestId: 1, kind: "photo", photoStage: "after" },
  ]);
}
beforeEach(() => {
  db.clear();
  boundary.db = db;
  db.put(s.settings, [
    {
      id: 1,
      artisanUserId: 1,
      trackingSecret: "d".repeat(64),
      proposalExpiryHours: 72,
      calendarEnabled: false,
      emailEnabled: false,
      smsEnabled: false,
    },
  ]);
  db.put(s.users, [user(1, "admin"), user(2), user(3)]);
  db.put(s.requests, [request()]);
});
describe("réponses rapides et départ réel", () => {
  it("refuse de terminer une intervention sans photo après travaux", async () => {
    running();
    db.put(s.documents, []);
    await expect(
      owner().requests.artisanAction({
        id: 1,
        version: 0,
        action: "complete",
        message:
          "Travaux terminés, résultat propre et zone entièrement nettoyée.",
      })
    ).rejects.toThrow("Un commentaire ne peut pas remplacer cette preuve");
  });
  it("enregistre la validation client sans la déduire d’une absence de réponse", async () => {
    running();
    await owner().requests.artisanAction({
      id: 1,
      version: 0,
      action: "complete",
      message: "Travaux terminés et zone nettoyée.",
    });
    await client().requests.clientAction({
      reference: "MDS-memory-1",
      token,
      version: 1,
      action: "confirmCompletion",
      message: "Résultat conforme.",
    });
    expect(db.rows(s.interventions)[0]).toMatchObject({
      clientConfirmedAt: expect.any(Date),
      clientConfirmationMessage: "Résultat conforme.",
    });
  });
  it("valide et clôture automatiquement après preuve photo, signature et paiement", async () => {
    db.put(s.requests, [request(1, { status: "paid" })]);
    db.put(s.interventions, [{
      id: 1,
      requestId: 1,
      appointmentId: 1,
      startedAt: new Date(),
      completedAt: new Date(),
      clientConfirmedAt: new Date(),
      clientConfirmationMessage: "Résultat conforme.",
    }]);
    db.put(s.documents, [{ id: 99, requestId: 1, kind: "photo", photoStage: "after" }]);
    const result = await owner().assistant.autoValidate({ requestId: 1 });
    expect(result).toMatchObject({ success: true });
    expect(db.rows(s.requests)[0]).toMatchObject({ status: "closed", version: 1 });
  });
  it("bloque la validation automatique si la preuve photo manque", async () => {
    db.put(s.requests, [request(1, { status: "paid" })]);
    db.put(s.interventions, [{
      id: 1,
      requestId: 1,
      appointmentId: 1,
      startedAt: new Date(),
      completedAt: new Date(),
      clientConfirmedAt: new Date(),
    }]);
    db.put(s.documents, []);
    await expect(owner().assistant.autoValidate({ requestId: 1 })).rejects.toThrow("photo après travaux");
    expect(db.rows(s.requests)[0].status).toBe("paid");
  });

  it.each(["photo", "diagnostic"] as const)(
    "%s demande une information sans réserver ni créer de prix",
    async action => {
      db.put(s.requests, [
        request(1, {
          status: "to_analyze",
          proposedStart: null,
          proposedPriceCents: null,
        }),
      ]);
      await owner().requests.artisanAction({ id: 1, version: 0, action });
      expect(db.rows(s.requests)[0]).toMatchObject({
        status: "needs_information",
        proposedPriceCents: null,
        version: 1,
      });
      expect(db.rows(s.appointments)).toHaveLength(0);
      expect(db.rows(s.events)[0].message).toMatch(
        action === "photo" ? /photo nette/ : /diagnostic.*organisé/
      );
    }
  );
  it("départ impossible sans rendez-vous actif, puis événement truthful", async () => {
    await expect(
      owner().requests.artisanAction({ id: 1, version: 0, action: "depart" })
    ).rejects.toThrow("rendez-vous confirmé actif");
    active();
    await owner().requests.artisanAction({
      id: 1,
      version: 0,
      action: "depart",
    });
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "en_route",
      departedAt: expect.any(Date),
      version: 1,
    });
    expect(db.rows(s.events)[0]).toMatchObject({
      status: "en_route",
      actorType: "artisan",
    });
    expect(db.rows(s.interventions)[0].startedAt).toBeNull();
    await owner().requests.artisanAction({
      id: 1,
      version: 1,
      action: "start",
    });
    expect(db.rows(s.requests)[0].status).toBe("in_progress");
  });
  it("annulation client reste possible en route sans progression inventée", async () => {
    db.put(s.requests, [
      request(1, { status: "en_route", departedAt: new Date() }),
    ]);
    active();
    db.put(s.extraWorks, [
      extra({ status: "accepted", acceptedAt: new Date() }),
    ]);
    await client().requests.clientAction({
      reference: "MDS-memory-1",
      version: 0,
      action: "cancel",
    });
    expect(db.rows(s.requests)[0].status).toBe("cancelled");
    expect(db.rows(s.appointments)[0].status).toBe("cancelled");
    expect(db.rows(s.extraWorks)[0].status).toBe("cancelled");
  });
});
describe("alternatives connues du serveur", () => {
  async function proposed() {
    db.put(s.requests, [request(1, { status: "to_analyze" })]);
    await owner().requests.artisanAction({
      id: 1,
      version: 0,
      action: "propose",
      proposedStart: future,
      alternativeStarts: [alternate, alternate, future],
      priceCents: 12000,
    });
    return db.rows(s.requests)[0];
  }
  it("stocke des UUID stables et vérifie chaque alternative sans réservation", async () => {
    const r = await proposed();
    expect(r.alternatives).toHaveLength(1);
    expect(r.alternatives[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(db.rows(s.appointments)).toHaveLength(0);
    db.put(s.appointments, [
      {
        id: 9,
        requestId: 9,
        status: "confirmed",
        startAt: new Date(alternate),
        endAt: new Date("2030-01-03T11:00:00Z"),
      },
    ]);
    await expect(
      owner().requests.artisanAction({
        id: 1,
        version: 1,
        action: "propose",
        proposedStart: future,
        alternativeStarts: [alternate],
      })
    ).rejects.toThrow("conflit");
    expect(db.rows(s.requests)[0].alternatives).toEqual(r.alternatives);
  });
  it("rejette les dates client et identifiants inconnus puis confirme exactement l’alternative sauvegardée", async () => {
    const r = await proposed();
    await expect(
      client().requests.clientAction({
        reference: r.reference,
        version: 1,
        action: "confirm",
        alternativeId: "invented",
      })
    ).rejects.toThrow("proposition MDS");
    await expect(
      client().requests.clientAction({
        reference: r.reference,
        version: 1,
        action: "confirm",
        desiredStart: alternate,
      })
    ).rejects.toThrow("uniquement");
    const input = {
      reference: r.reference,
      version: 1,
      action: "confirm" as const,
      alternativeId: r.alternatives[0].id,
    };
    await Promise.all([
      client().requests.clientAction(input),
      client().requests.clientAction(input),
    ]);
    expect(db.rows(s.appointments)).toHaveLength(1);
    expect(db.rows(s.interventions)).toHaveLength(1);
    expect(db.rows(s.appointments)[0].startAt.toISOString()).toBe(
      new Date(alternate).toISOString()
    );
  });
  it("recontrôle le calendrier à la confirmation et oblige un nouvel accord en replanification", async () => {
    const r = await proposed();
    db.put(s.availability, [
      {
        id: 1,
        kind: "blocked",
        startAt: new Date(alternate),
        endAt: new Date("2030-01-03T11:00:00Z"),
      },
    ]);
    await expect(
      client().requests.clientAction({
        reference: r.reference,
        version: 1,
        action: "confirm",
        alternativeId: r.alternatives[0].id,
      })
    ).rejects.toThrow("conflit");
    expect(db.rows(s.appointments)).toHaveLength(0);
    await client().requests.clientAction({
      reference: r.reference,
      version: 1,
      action: "reschedule",
      desiredStart: alternate,
    });
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "awaiting_mds",
      proposedStart: null,
      alternatives: [],
    });
    await expect(
      client().requests.clientAction({
        reference: r.reference,
        version: 2,
        action: "confirm",
      })
    ).rejects.toThrow("état");
  });
  it("expiration exportée auditée et appel ultérieur idempotent", async () => {
    db.put(s.requests, [
      request(1, {
        status: "awaiting_client",
        expiresAt: new Date("2020-01-01"),
      }),
    ]);
    await db.transaction(async tx => {
      const r = db.rows(s.requests)[0];
      expect(await expireRequest(tx, structuredClone(r))).toBe(true);
    });
    const expired = db.rows(s.requests)[0];
    expect(expired.status).toBe("expired");
    await db.transaction(async tx => {
      expect(await expireRequest(tx, structuredClone(expired))).toBe(false);
    });
    expect(db.rows(s.events)).toHaveLength(1);
  });
});
describe("incidents sans état fictif", () => {
  it("incident bloque début et fin jusqu’à résolution manuelle versionnée", async () => {
    active();
    const incident = await owner().operations.report({
      requestId: 1,
      version: 0,
      kind: "client_absent",
      message: "Client absent au rendez-vous convenu",
    });
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "planned",
      version: 1,
    });
    expect(db.rows(s.events)[0].status).toBe("planned");
    await expect(
      owner().requests.artisanAction({ id: 1, version: 1, action: "start" })
    ).rejects.toThrow("bloquant");
    await expect(
      owner().operations.resolve({
        id: incident.id,
        requestVersion: 0,
        resolution: "Client revenu sur place",
      })
    ).rejects.toThrow("changé");
    await owner().operations.resolve({
      id: incident.id,
      requestVersion: 1,
      resolution: "Client revenu sur place",
    });
    expect(db.rows(s.requests)[0].status).toBe("planned");
    await owner().requests.artisanAction({
      id: 1,
      version: 2,
      action: "start",
    });
    await owner().operations.report({
      requestId: 1,
      version: 3,
      kind: "problem",
      message: "Accès à l’installation temporairement impossible",
    });
    await expect(
      owner().requests.artisanAction({ id: 1, version: 4, action: "complete" })
    ).rejects.toThrow("bloquant");
  });
  it("absence de créneau est informative et ne bloque pas une intervention confirmée", async () => {
    active();
    await owner().operations.report({
      requestId: 1,
      version: 0,
      kind: "no_slot",
      message: "Aucun créneau de remplacement disponible",
    });
    await owner().requests.artisanAction({
      id: 1,
      version: 1,
      action: "start",
    });
    expect(db.rows(s.requests)[0].status).toBe("in_progress");
  });
  it("réclamation exclusivement client autorisé, sans saut d’état", async () => {
    const input = {
      reference: "MDS-memory-1",
      version: 0,
      message: "Réclamation concernant les conditions convenues",
    };
    await expect(owner().operations.complaint(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller(user(3)).operations.complaint(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await caller().operations.complaint({ ...input, token });
    expect(db.rows(s.incidents)[0]).toMatchObject({
      kind: "complaint",
      actorType: "client",
    });
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "planned",
      version: 1,
    });
  });
});
describe("suppléments : accord et exécution séparés", () => {
  const proposal = {
    requestId: 1,
    version: 0,
    scope: "Remplacement du flexible détérioré",
    amountCents: 3000,
    durationMinutes: 20,
    conditions: "Flexible compris, autres pièces exclues",
  };
  it("propose une portée immuable sans changer le prix principal et refuse document hors scope", async () => {
    await expect(
      owner().operations.proposeExtra({ ...proposal, documentId: 99 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await owner().operations.proposeExtra(proposal);
    expect(db.rows(s.requests)[0]).toMatchObject({
      proposedPriceCents: 12000,
      version: 1,
    });
    expect(db.rows(s.extraWorks)[0]).toMatchObject({
      scope: proposal.scope,
      amountCents: 3000,
      status: "pending",
    });
    await expect(
      owner().operations.startExtra({ id: 1, version: 0 })
    ).rejects.toThrow("état");
  });
  it("accord client interdit artisan/autre dossier, version vérifiée et double réponse sérialisée", async () => {
    db.put(s.extraWorks, [extra()]);
    const response = {
      reference: "MDS-memory-1",
      id: 1,
      version: 0,
      accept: true,
    };
    await expect(
      owner().operations.respondExtra(response)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.put(s.extraWorks, [extra({ requestId: 2 })]);
    await expect(
      client().operations.respondExtra(response)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.put(s.extraWorks, [extra()]);
    await expect(
      client().operations.respondExtra({ ...response, version: 3 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const results = await Promise.allSettled([
      client().operations.respondExtra(response),
      client().operations.respondExtra({ ...response, accept: false }),
    ]);
    expect(results.filter(row => row.status === "fulfilled")).toHaveLength(1);
    expect(db.rows(s.extraWorks)[0]).toMatchObject({
      status: "accepted",
      acceptedAt: expect.any(Date),
      version: 1,
    });
    expect(db.rows(s.requests)[0].status).toBe("planned");
  });
  it("proposition expirée enregistrée comme refus sans accord même si API retourne conflit", async () => {
    db.put(s.extraWorks, [extra({ expiresAt: new Date("2020-01-01") })]);
    await expect(
      client().operations.respondExtra({
        reference: "MDS-memory-1",
        id: 1,
        version: 0,
        accept: true,
      })
    ).rejects.toThrow("expiré");
    expect(db.rows(s.extraWorks)[0]).toMatchObject({
      status: "refused",
      acceptedAt: null,
      version: 1,
    });
    expect(db.rows(s.requests)[0].version).toBe(1);
  });
  it("aucune exécution sans main réellement commencée, accord ou résolution des problèmes", async () => {
    running();
    db.put(s.extraWorks, [extra()]);
    await expect(
      owner().operations.startExtra({ id: 1, version: 0 })
    ).rejects.toThrow("accord client");
    await client().operations.respondExtra({
      reference: "MDS-memory-1",
      id: 1,
      version: 0,
      accept: true,
    });
    db.put(s.incidents, [
      { id: 1, requestId: 1, kind: "problem", status: "open" },
    ]);
    await expect(
      owner().operations.startExtra({ id: 1, version: 1 })
    ).rejects.toThrow("bloquant");
    db.put(s.incidents, []);
    await owner().operations.startExtra({ id: 1, version: 1 });
    expect(db.rows(s.extraWorks)[0]).toMatchObject({
      status: "in_progress",
      startedAt: expect.any(Date),
    });
    await expect(
      owner().requests.artisanAction({ id: 1, version: 2, action: "complete" })
    ).rejects.toThrow("suppléments");
    await owner().operations.completeExtra({ id: 1, version: 2 });
    await owner().requests.artisanAction({
      id: 1,
      version: 3,
      action: "complete",
    });
    expect(db.rows(s.requests)[0].status).toBe("completed");
  });
  it.each(["pending", "accepted"])(
    "supplément %s bloque fin jusqu’à annulation explicite",
    async status => {
      running();
      db.put(s.extraWorks, [
        extra({
          status,
          acceptedAt: status === "accepted" ? new Date() : null,
        }),
      ]);
      await expect(
        owner().requests.artisanAction({
          id: 1,
          version: 0,
          action: "complete",
        })
      ).rejects.toThrow("suppléments");
      await owner().operations.cancelExtra({ id: 1, version: 0 });
      await owner().requests.artisanAction({
        id: 1,
        version: 1,
        action: "complete",
      });
      expect(db.rows(s.extraWorks)[0].status).toBe("cancelled");
    }
  );
  it("facture agrège uniquement les suppléments acceptés ET réellement terminés", async () => {
    db.put(s.requests, [request(1, { status: "completed" })]);
    db.put(s.extraWorks, [
      extra({
        status: "completed",
        acceptedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      }),
      extra({ id: 2, status: "refused" }),
      extra({ id: 3, status: "cancelled", acceptedAt: new Date() }),
    ]);
    db.put(s.documents, [{ id: 1, requestId: 1, kind: "invoice" }]);
    await owner().requests.artisanAction({
      id: 1,
      version: 0,
      action: "invoice",
    });
    expect(db.rows(s.invoices)[0].amountCents).toBe(12000 + 3000);
  });
  it("supplément mal marqué terminé sans preuve est non facturable", async () => {
    db.put(s.requests, [request(1, { status: "completed" })]);
    db.put(s.extraWorks, [extra({ status: "completed" })]);
    db.put(s.documents, [{ id: 1, requestId: 1, kind: "invoice" }]);
    await expect(
      owner().requests.artisanAction({ id: 1, version: 0, action: "invoice" })
    ).rejects.toThrow("preuve d’accord");
    expect(db.rows(s.invoices)).toHaveLength(0);
  });
});
describe("règlement manuel du solde commercial net", () => {
  function invoiced() {
    db.put(s.requests, [request(1, { status: "invoiced" })]);
    db.put(s.invoices, [
      {
        id: 1,
        requestId: 1,
        amountCents: 15000,
        currency: "EUR",
        paidAt: null,
      },
    ]);
    db.put(s.extraWorks, [
      extra({
        status: "completed",
        acceptedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    ]);
  }
  it("soustrait l’acompte et les remboursements réels, jamais les tests", async () => {
    invoiced();
    db.put(s.payments, [
      {
        id: 1,
        requestId: 1,
        provider: "stripe",
        mode: "live",
        status: "succeeded",
        currency: "EUR",
        amountCents: 4000,
        receivedAmountCents: 4000,
        confirmedAt: new Date(),
        creditedAt: new Date(),
      },
      {
        id: 2,
        requestId: 1,
        provider: "stripe",
        mode: "test",
        status: "succeeded",
        currency: "EUR",
        receivedAmountCents: 9000,
        creditedAt: new Date(),
        confirmedAt: new Date(),
      },
    ]);
    db.put(s.refunds, [
      {
        id: 1,
        paymentId: 1,
        amountCents: 1000,
        status: "succeeded",
        mode: "live",
        currency: "EUR",
        confirmedAt: new Date(),
      },
    ]);
    await owner().requests.artisanAction({
      id: 1,
      version: 0,
      action: "paid",
      message: "Virement du solde vérifié sur le relevé bancaire",
    });
    expect(
      db.rows(s.payments).find(p => p.provider === "manual")
    ).toMatchObject({
      amountCents: 15000 - (4000 - 1000),
      receivedAmountCents: 15000 - (4000 - 1000),
      creditedAt: expect.any(Date),
    });
  });
  it.each(["pending", "failed", "succeeded"])(
    "bloque le règlement manuel si Stripe live %s est non rapproché",
    async status => {
      invoiced();
      db.put(s.payments, [
        {
          id: 1,
          requestId: 1,
          invoiceId: null,
          provider: "stripe",
          mode: "live",
          status,
          currency: "EUR",
          creditedAt: null,
        },
      ]);
      await expect(
        owner().requests.artisanAction({
          id: 1,
          version: 0,
          action: "paid",
          message: "Virement vérifié sur le relevé bancaire",
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(db.rows(s.invoices)[0].paidAt).toBeNull();
    }
  );
});
