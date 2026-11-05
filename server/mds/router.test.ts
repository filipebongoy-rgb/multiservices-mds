import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { hash } from "./common";
const boundary = vi.hoisted(() => ({
  db: null as any,
  put: vi.fn(),
  signed: vi.fn(),
}));
vi.mock("../db", () => ({ getDb: async () => boundary.db }));
vi.mock("../storage", () => ({
  storagePut: (...args: any[]) => boundary.put(...args),
  storageGetSignedUrl: (...args: any[]) => boundary.signed(...args),
}));
import { mdsRouter } from "./router";
const db = new MockDatabase();
const secret = "unit-tests-signing-only-never-production";
const user = (
  id: number,
  role: "user" | "admin" = "user",
  email = `u${id}@example.test`
): s.User => ({
  id,
  openId: `test-${id}`,
  role,
  name: `Test ${id}`,
  email,
  loginMethod: "manus",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
});
const context = (u: s.User | null = null): TrpcContext => ({
  user: u,
  req: { headers: {} } as any,
  res: { set: vi.fn() } as any,
});
const caller = (u: s.User | null = null) => mdsRouter.createCaller(context(u));
function request(id = 1, patch: Partial<s.MdsRequest> = {}): s.MdsRequest {
  return {
    id,
    reference: `MDS-test-${id}`,
    trackingHash: hash(secret + id),
    idempotencyHash: "idem-" + id,
    payloadHash: "payload",
    userId: 2,
    clientId: 1,
    serviceId: null,
    serviceName: null,
    description: "Une fuite à analyser",
    problemType: "",
    name: "Test client",
    email: "client@example.test",
    phone: "0102030405",
    address: "1 rue du test",
    postcode: "75001",
    city: "Paris",
    desiredStart: new Date("2030-01-01T10:00:00Z"),
    organizationId: null,
    siteId: null,
    pricingSnapshot: null,
    answers: {},
    consentAt: new Date(),
    status: "awaiting_client",
    version: 0,
    proposedStart: new Date("2030-01-01T10:00:00Z"),
    proposedPriceCents: 12000,
    durationMinutes: 60,
    proposalMessage: null,
    expiresAt: new Date("2030-01-01"),
    quoteStatus: "none",
    lastAction: null,
    lastActionVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...patch,
  };
}
beforeEach(() => {
  vi.stubEnv("MANUS_JWT_SECRET", "unit-test-idempotency-secret");
  db.clear();
  boundary.db = db;
  db.put(s.settings, [
    {
      id: 1,
      trackingSecret: "d".repeat(64),
      artisanUserId: 1,
      activationHash: null,
      activationUsedAt: new Date(),
      proposalExpiryHours: 72,
      legalNotice: "",
      zone: "",
      contactEmail: "",
      contactPhone: "",
      businessAddress: "",
      legalName: "",
    },
  ]);
  db.put(s.users, [user(1, "admin"), user(2), user(3)]);
  db.put(s.requests, [request()]);
  boundary.put.mockReset();
  boundary.signed.mockReset();
  vi.unstubAllGlobals();
});
describe("double validation transactionnelle", () => {
  it("accept MDS publie accord et attente, jamais rendez-vous", async () => {
    db.put(s.requests, [
      request(1, {
        status: "to_analyze",
        proposedStart: null,
        proposedPriceCents: null,
      }),
    ]);
    await caller(user(1, "admin")).requests.artisanAction({
      id: 1,
      version: 0,
      action: "accept",
      proposedStart: "2030-01-01T10:00:00Z",
      priceCents: 12000,
    });
    expect(db.rows(s.appointments)).toHaveLength(0);
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "awaiting_client",
      version: 1,
    });
    expect(db.rows(s.events).map(e => e.status)).toEqual([
      "accepted_mds",
      "awaiting_client",
    ]);
    expect(db.rows(s.notifications)).toHaveLength(4);
    expect(db.operations[1]).toMatchObject({
      table: "mds_settings",
      locked: true,
    });
  });
  it("proposition exige nouveau créneau et prix défini", async () => {
    db.put(s.requests, [
      request(1, { status: "to_analyze", proposedPriceCents: null }),
    ]);
    await expect(
      caller(user(1, "admin")).requests.artisanAction({
        id: 1,
        version: 0,
        action: "propose",
      })
    ).rejects.toThrow("créneau");
    await expect(
      caller(user(1, "admin")).requests.artisanAction({
        id: 1,
        version: 0,
        action: "accept",
      })
    ).rejects.toThrow("prix");
    expect(db.rows(s.appointments)).toHaveLength(0);
  });
  it("double confirmation concurrente produit un seul rendez-vous et intervention", async () => {
    const input = {
      reference: "MDS-test-1",
      token: secret + 1,
      version: 0,
      action: "confirm" as const,
    };
    const results = await Promise.all([
      caller().requests.clientAction(input),
      caller().requests.clientAction(input),
    ]);
    expect(results).toEqual([{ success: true }, { success: true }]);
    expect(db.rows(s.appointments)).toHaveLength(1);
    expect(db.rows(s.interventions)).toHaveLength(1);
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "planned",
      version: 1,
    });
    expect(db.rows(s.events).map(e => e.status)).toEqual([
      "confirmed",
      "planned",
    ]);
    expect(
      db.operations.filter(o => o.locked && o.table === "mds_settings")
    ).toHaveLength(2);
  });
  it("deux demandes concurrentes qui se chevauchent ne réservent jamais le même artisan", async () => {
    db.put(s.requests, [request(1), request(2)]);
    const results = await Promise.allSettled(
      [1, 2].map(id =>
        caller().requests.clientAction({
          reference: `MDS-test-${id}`,
          token: secret + id,
          version: 0,
          action: "confirm",
        })
      )
    );
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(db.rows(s.appointments)).toHaveLength(1);
    expect(
      db.rows(s.requests).filter(r => r.status === "planned")
    ).toHaveLength(1);
  });
  it("bloque aussi les indisponibilités réelles", async () => {
    db.put(s.availability, [
      {
        id: 1,
        kind: "blocked",
        startAt: new Date("2030-01-01T09:00:00Z"),
        endAt: new Date("2030-01-01T12:00:00Z"),
      },
    ]);
    await expect(
      caller(user(2)).requests.clientAction({
        reference: "MDS-test-1",
        version: 0,
        action: "confirm",
      })
    ).rejects.toThrow("conflit");
    expect(db.rows(s.appointments)).toHaveLength(0);
  });
  it("une version périmée ne modifie ni dossier ni historique", async () => {
    db.put(s.requests, [request(1, { version: 3 })]);
    await expect(
      caller(user(2)).requests.clientAction({
        reference: "MDS-test-1",
        version: 0,
        action: "confirm",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows(s.events)).toHaveLength(0);
    expect(db.rows(s.appointments)).toHaveLength(0);
    expect(db.rows(s.requests)[0].version).toBe(3);
  });
  it("expire et COMMIT l’événement même si l’action retourne CONFLICT", async () => {
    db.put(s.requests, [request(1, { expiresAt: new Date("2020-01-01") })]);
    await expect(
      caller(user(2)).requests.clientAction({
        reference: "MDS-test-1",
        version: 0,
        action: "confirm",
      })
    ).rejects.toThrow("expiré");
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "expired",
      version: 1,
    });
    expect(db.rows(s.events).map(e => e.status)).toEqual(["expired"]);
    expect(db.rows(s.notifications)).toHaveLength(2);
  });
  it("l’acceptation devis reste séparée de confirm", async () => {
    db.put(s.requests, [
      request(1, { status: "quote_pending", quoteStatus: "pending" }),
    ]);
    db.put(s.quotes, [
      { id: 1, requestId: 1, documentId: 10, status: "pending" },
    ]);
    await expect(
      caller(user(2)).requests.clientAction({
        reference: "MDS-test-1",
        version: 0,
        action: "confirm",
      })
    ).rejects.toThrow("état");
    await caller(user(2)).requests.clientAction({
      reference: "MDS-test-1",
      version: 0,
      action: "acceptQuote",
    });
    expect(db.rows(s.appointments)).toHaveLength(0);
    expect(db.rows(s.requests)[0].quoteStatus).toBe("accepted");
    await caller(user(2)).requests.clientAction({
      reference: "MDS-test-1",
      version: 1,
      action: "confirm",
    });
    expect(db.rows(s.appointments)).toHaveLength(1);
  });
  it("facture nécessite vrai document et paiement vérification explicite", async () => {
    db.put(s.requests, [request(1, { status: "completed" })]);
    await expect(
      caller(user(1, "admin")).requests.artisanAction({
        id: 1,
        version: 0,
        action: "invoice",
      })
    ).rejects.toThrow("vrai document");
    db.put(s.documents, [{ id: 10, requestId: 1, kind: "invoice" }]);
    await caller(user(1, "admin")).requests.artisanAction({
      id: 1,
      version: 0,
      action: "invoice",
    });
    await expect(
      caller(user(1, "admin")).requests.artisanAction({
        id: 1,
        version: 1,
        action: "paid",
      })
    ).rejects.toThrow("vérification réelle");
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
    await caller(user(1, "admin")).requests.artisanAction({
      id: 1,
      version: 1,
      action: "paid",
      message: "Virement vérifié sur le relevé du 2 janvier",
    });
    expect(db.rows(s.invoices)[0]).toMatchObject({
      paymentVerifiedBy: 1,
      verificationNote: "Virement vérifié sur le relevé du 2 janvier",
    });
  });
});
describe("droits et confidentialité", () => {
  it("créations concurrentes idempotentes et payload différent rejeté", async () => {
    db.put(s.requests, []);
    const input = {
      serviceId: null,
      description: "Une demande de réparation libre",
      name: "Client test",
      email: "u2@example.test",
      phone: "0102030405",
      address: "1 rue du test",
      postcode: "75001",
      city: "Paris",
      desiredStart: null,
      consent: true as const,
      idempotencyKey: "unit-idem-at-least-16",
    };
    const [a, b] = await Promise.all([
      caller(user(2)).requests.create(input),
      caller(user(2)).requests.create(input),
    ]);
    expect(a).toEqual(b);
    expect(db.rows(s.requests)).toHaveLength(1);
    expect(db.rows(s.clients)).toHaveLength(1);
    expect(db.rows(s.requests)[0].status).toBe("to_analyze");
    expect(db.rows(s.events).map(e => e.status)).toEqual([
      "sent",
      "to_analyze",
    ]);
    await expect(
      caller(user(2)).requests.create({
        ...input,
        description: "Une description différente",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows(s.requests)).toHaveLength(1);
  });
  it("un token ne remplace jamais l’appartenance organisation et la révocation bloque l’auteur", async () => {
    db.put(s.requests, [request(1, { organizationId: 7, userId: 3 })]);
    db.put(s.members, [
      { id: 1, organizationId: 7, userId: 3, role: "member" },
    ]);
    await expect(
      caller().requests.track({ reference: "MDS-test-1", token: secret + 1 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await caller(user(3)).requests.mine()).toHaveLength(1);
    db.put(s.members, []);
    await expect(
      caller(user(3)).requests.detail({ id: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(user(3)).requests.clientAction({
        reference: "MDS-test-1",
        token: secret + 1,
        version: 0,
        action: "confirm",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await caller(user(3)).requests.mine()).toHaveLength(0);
    db.put(s.documents, [
      { id: 10, requestId: 1, organizationId: 7, name: "document.pdf" },
    ]);
    await expect(
      caller(user(3)).documents.download({
        id: 10,
        reference: "MDS-test-1",
        token: secret + 1,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(boundary.signed).not.toHaveBeenCalled();
  });
  it("le rattachement invité exige token ET email OAuth, jamais email seul", async () => {
    db.put(s.requests, [
      request(1, { userId: null, email: "U2@example.test" }),
    ]);
    db.put(s.clients, [{ id: 1, userId: null }]);
    await expect(
      caller(user(2)).requests.claim({
        reference: "MDS-test-1",
        token: "invalid-token-long-16",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(user(3)).requests.claim({
        reference: "MDS-test-1",
        token: secret + 1,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await caller(user(2)).requests.claim({
      reference: "MDS-test-1",
      token: secret + 1,
    });
    expect(db.rows(s.requests)[0]).toMatchObject({
      userId: 2,
      version: 1,
      status: "awaiting_client",
    });
    expect(db.rows(s.clients)[0].userId).toBe(2);
    await caller(user(2)).requests.claim({
      reference: "MDS-test-1",
      token: secret + 1,
    });
    expect(db.rows(s.audit)).toHaveLength(1);
    expect((await caller(user(2)).requests.detail({ id: 1 })).request.id).toBe(
      1
    );
  });
  it("refuse un artisan de s’accorder lui-même la validation client", async () => {
    await expect(
      caller(user(1, "admin")).requests.clientAction({
        reference: "MDS-test-1",
        version: 0,
        action: "confirm",
      })
    ).rejects.toThrow("pas par l’artisan");
  });
  it("refuse détail sans token et autres utilisateurs hors organisation", async () => {
    await expect(
      caller().requests.track({ reference: "MDS-test-1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(user(3)).requests.detail({ id: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const result = await caller().requests.track({
      reference: "MDS-test-1",
      token: secret + 1,
    });
    expect(result.request).not.toHaveProperty("trackingHash");
    expect(result.request).not.toHaveProperty("idempotencyHash");
    expect(result.reviews).toEqual([]);
  });
  it("autorise membres organisation mais pas un orgId déclaré sans appartenance", async () => {
    db.put(s.requests, [request(1, { organizationId: 7 })]);
    db.put(s.members, [
      { id: 1, organizationId: 7, userId: 3, role: "member" },
    ]);
    expect((await caller(user(3)).requests.detail({ id: 1 })).request.id).toBe(
      1
    );
    db.put(s.members, []);
    await expect(
      caller(user(3)).requests.detail({ id: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("guest ne peut transférer que sa photo autorisée AVANT storagePut", async () => {
    await expect(
      caller().documents.upload({
        reference: "MDS-test-1",
        token: "bad-token-at-least-16",
        name: "photo.jpg",
        mimeType: "image/jpeg",
        base64: "AAAA",
        kind: "photo",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().documents.upload({
        reference: "MDS-test-1",
        token: secret + 1,
        name: "devis.pdf",
        mimeType: "application/pdf",
        base64: "AAAA",
        kind: "quote",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(boundary.put).not.toHaveBeenCalled();
  });
  it("transfère ciphertext seulement et restitue base64 sans clés ni URL", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9]);
    boundary.put.mockResolvedValue({
      key: "private/test.bin",
      url: "/manus-storage/private/test.bin",
    });
    const doc = await caller().documents.upload({
      reference: "MDS-test-1",
      token: secret + 1,
      name: "photo.jpg",
      mimeType: "image/jpeg",
      base64: jpeg.toString("base64"),
      kind: "photo",
    });
    const cipher = boundary.put.mock.calls[0][1];
    expect(cipher.equals(jpeg)).toBe(false);
    expect(boundary.put.mock.calls[0][2]).toBe("application/octet-stream");
    boundary.signed.mockResolvedValue(
      "https://storage.example.test/ciphertext"
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(cipher)));
    const result = await caller().documents.download({
      id: doc.id,
      reference: "MDS-test-1",
      token: secret + 1,
    });
    expect(result).toEqual({
      base64: jpeg.toString("base64"),
      name: "photo.jpg",
      mimeType: "image/jpeg",
    });
    expect(Object.keys(result)).toEqual(["base64", "name", "mimeType"]);
  });
  it("évaluation exige identité autorisée et intervention terminée, anti-doublon", async () => {
    await expect(
      caller().reviews.submit({ requestId: 1, rating: 5 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(user(2)).reviews.submit({ requestId: 1, rating: 5 })
    ).rejects.toThrow("terminée");
    db.put(s.requests, [request(1, { status: "completed" })]);
    db.put(s.interventions, [{ id: 1, requestId: 1, completedAt: new Date() }]);
    await caller(user(2)).reviews.submit({ requestId: 1, rating: 5 });
    expect(db.rows(s.reviews)[0]).toMatchObject({
      authorType: "client",
      moderation: "pending",
    });
    await expect(
      caller(user(2)).reviews.submit({ requestId: 1, rating: 4 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller(user(3)).reviews.submit({ requestId: 1, rating: 5 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("activation unique : aucun premier visiteur administrateur et course refusée", async () => {
    const code = "a".repeat(64);
    db.put(s.settings, [
      {
        id: 1,
        artisanUserId: null,
        activationHash: hash(code),
        activationUsedAt: null,
      },
    ]);
    db.put(s.users, [user(2), user(3)]);
    await expect(
      caller(user(2)).claimArtisan({ code: "b".repeat(64) })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.rows(s.users).every(u => u.role === "user")).toBe(true);
    const results = await Promise.allSettled([
      caller(user(2)).claimArtisan({ code }),
      caller(user(3)).claimArtisan({ code }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(db.rows(s.users).filter(u => u.role === "admin")).toHaveLength(1);
    expect(db.rows(s.settings)[0].activationHash).toBeNull();
    expect(db.rows(s.audit)).toHaveLength(1);
  });
  it("invitation vérifie l’email OAuth exact, pas celui du contact", async () => {
    const code = "c".repeat(64);
    db.put(s.invitations, [
      {
        id: 1,
        organizationId: 7,
        codeHash: hash(code),
        email: "u3@example.test",
        role: "member",
        expiresAt: new Date("2030-01-01"),
        acceptedAt: null,
      },
    ]);
    await expect(caller(user(2)).organizations.join({ code })).rejects.toThrow(
      "exactement"
    );
    await caller(user(3)).organizations.join({ code });
    expect(db.rows(s.members)[0]).toMatchObject({
      userId: 3,
      organizationId: 7,
    });
  });
});

describe("devis brouillons dans les espaces professionnels", () => {
  it("cache les métadonnées générées non émises aux membres mais pas à l’artisan vérifié", async () => {
    db.put(s.organizations, [
      {
        id: 7,
        name: "Organisation de test",
        type: "entreprise",
        ownerUserId: 3,
      },
    ]);
    db.put(s.members, [
      { id: 1, organizationId: 7, userId: 3, role: "member" },
    ]);
    db.put(s.requests, [request(1, { organizationId: 7 })]);
    db.put(s.documents, [
      {
        id: 10,
        requestId: 1,
        organizationId: 7,
        kind: "quote",
        name: "brouillon-prive.pdf",
      },
      {
        id: 11,
        requestId: 1,
        organizationId: 7,
        kind: "quote",
        name: "devis-transmis.pdf",
      },
    ]);
    db.put(s.quoteDrafts, [
      { id: 1, requestId: 1, documentId: 10, status: "generated" },
      { id: 2, requestId: 1, documentId: 11, status: "issued" },
    ]);
    expect(
      (await caller(user(3)).organizations.detail({ id: 7 })).documents.map(
        d => d.id
      )
    ).toEqual([11]);
    expect(
      (
        await caller(user(1, "admin")).organizations.detail({ id: 7 })
      ).documents.map(d => d.id)
    ).toEqual([10, 11]);
  });
});
