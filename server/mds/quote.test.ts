import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import { router } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import { hash } from "./common";
import {
  quoteContentSchema,
  quoteTotals,
  type QuoteContent,
} from "../../shared/operations";
import { decryptFile } from "./files";
const boundary = vi.hoisted(() => ({ db: null as any, put: vi.fn() }));
vi.mock("../db", () => ({ getDb: async () => boundary.db }));
vi.mock("../storage", () => ({
  storagePut: (...args: any[]) => boundary.put(...args),
  storageGetSignedUrl: vi.fn(),
}));
import { requestsRouter } from "./requests";
import {
  quoteBuilderRouter,
  quoteValidityEnd,
  validateQuoteContent,
} from "./quote-builder";
import { renderQuotePdf } from "./quote-pdf";
const app = router({
  requests: requestsRouter,
  quoteBuilder: quoteBuilderRouter,
});
const db = new MockDatabase();
const token = "quote-test-only-private-track-token";
const user = (id: number, role: "user" | "admin" = "user"): s.User => ({
  id,
  role,
  openId: `quote-test-${id}`,
  name: "Test",
  email: `test${id}@example.test`,
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
function request(id = 1, patch: Partial<s.MdsRequest> = {}): s.MdsRequest {
  return {
    id,
    reference: `MDS-quote-test-${id}`,
    trackingHash: hash(token),
    idempotencyHash: `quote-idem-${id}`,
    payloadHash: "memory",
    userId: 2,
    clientId: id,
    serviceId: null,
    serviceName: null,
    description: "Travaux à préciser dans un devis de test",
    problemType: "",
    name: "Client test",
    email: "test@example.test",
    phone: "0102030405",
    address: "1 rue du test",
    postcode: "75001",
    city: "Paris",
    desiredStart: null,
    organizationId: null,
    siteId: null,
    pricingSnapshot: null,
    alternatives: [],
    departedAt: null,
    answers: {},
    consentAt: new Date(),
    status: "to_analyze",
    version: 0,
    proposedStart: null,
    proposedPriceCents: null,
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
const content = (): QuoteContent => ({
  issuerName: "Émetteur de test — mémoire uniquement",
  issuerAddress: "1 rue du test, 75001 Paris",
  issuerRegistration: "Immatriculation de test non commerciale",
  issuerEmail: "issuer@example.test",
  issuerPhone: "0102030405",
  clientName: "Client fictif pour test mémoire",
  clientAddress: "2 rue du test, 75001 Paris",
  title: "Remplacement de robinetterie — test",
  validUntil: "2030-01-10",
  lines: [
    {
      label: "Travail de test",
      quantity: 2,
      unitCents: 5000,
      vatBasisPoints: 2000,
    },
  ],
  included: "Pièces et pose de test",
  excluded: "Travaux hors périmètre",
  conditions: "Conditions explicitement renseignées pour le test",
  paymentTerms: "Paiement après facture, conditions de test",
  depositCents: 2000,
  taxNote: "Mention fiscale fournie pour le test",
  insuranceNote: "Assurance déclarée pour le test, sans attestation",
});
beforeEach(() => {
  db.clear();
  boundary.db = db;
  boundary.put.mockReset().mockResolvedValue({ key: "memory/private.pdf.bin" });
  db.put(s.settings, [
    {
      id: 1,
      artisanUserId: 1,
      trackingSecret: "c".repeat(64),
      proposalExpiryHours: 72,
      calendarEnabled: false,
      emailEnabled: false,
      smsEnabled: false,
    },
  ]);
  db.put(s.users, [user(1, "admin"), user(2)]);
  db.put(s.requests, [request()]);
});
describe("devis calculé et données explicites", () => {
  it("calcule en centimes chaque ligne HT et TVA sans montant fourni par le navigateur", () => {
    const lines = [
      { label: "Test", quantity: 3, unitCents: 333, vatBasisPoints: 550 },
    ];
    expect(quoteTotals(lines)).toEqual({
      netCents: 3 * 333,
      vatCents: Math.floor((3 * 333 * 550 + 5000) / 10000),
      totalCents: 3 * 333 + Math.floor((3 * 333 * 550 + 5000) / 10000),
    });
    expect(validateQuoteContent(content()).totalCents).toBe(
      2 * 5000 + (2 * 5000 * 2000) / 10000
    );
  });
  it("aucune invention d’immatriculation, mention fiscale ou assurance", () => {
    for (const key of [
      "issuerRegistration",
      "taxNote",
      "insuranceNote",
      "conditions",
    ] as const)
      expect(
        quoteContentSchema.safeParse({ ...content(), [key]: "" }).success
      ).toBe(false);
  });
  it("acompte excessif, totaux hors limite et dates impossibles/expirées rejetés", () => {
    expect(() =>
      validateQuoteContent({ ...content(), depositCents: 12001 })
    ).toThrow("acompte");
    expect(() =>
      quoteTotals([
        {
          label: "Overflow",
          quantity: 10000,
          unitCents: 99999999,
          vatBasisPoints: 10000,
        },
      ])
    ).toThrow("élevé");
    expect(() =>
      validateQuoteContent({ ...content(), validUntil: "2030-02-31" })
    ).toThrow("date");
    expect(() =>
      validateQuoteContent({ ...content(), validUntil: "2020-01-01" })
    ).toThrow("future");
  });
  it("fin de validité utilise le jour civil complet de Paris, y compris changements d’heure", () => {
    expect(quoteValidityEnd("2027-03-27").toISOString()).toBe(
      "2027-03-27T23:00:00.000Z"
    );
    expect(quoteValidityEnd("2027-03-28").toISOString()).toBe(
      "2027-03-28T22:00:00.000Z"
    );
    expect(quoteValidityEnd("2027-10-30").toISOString()).toBe(
      "2027-10-30T22:00:00.000Z"
    );
    expect(quoteValidityEnd("2027-10-31").toISOString()).toBe(
      "2027-10-31T23:00:00.000Z"
    );
  });
});
describe("brouillons privés, versionnés et sans créneau obligatoire", () => {
  it("sauve sans date d’intervention et ne réserve ni paiement ni accord client", async () => {
    const saved = await owner().quoteBuilder.save({
      requestId: 1,
      requestVersion: 0,
      content: content(),
    });
    expect(saved).toMatchObject({
      status: "draft",
      version: 0,
      totalCents: 12000,
    });
    expect(saved.reference).toMatch(/^MDS-D-/);
    expect(db.rows(s.requests)[0]).toMatchObject({
      proposedStart: null,
      status: "to_analyze",
      version: 1,
    });
    expect(db.rows(s.appointments)).toHaveLength(0);
    expect(db.rows(s.paymentPlans)).toHaveLength(0);
    expect(db.rows(s.quotes)).toHaveLength(0);
    expect(await owner().quoteBuilder.list({ requestId: 1 })).toHaveLength(1);
    await expect(
      caller(user(2)).quoteBuilder.list({ requestId: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("vérifie version du dossier ET du brouillon, scope et état négociable", async () => {
    const saved = await owner().quoteBuilder.save({
      requestId: 1,
      requestVersion: 0,
      content: content(),
    });
    await expect(
      owner().quoteBuilder.save({
        requestId: 1,
        requestVersion: 0,
        id: saved.id,
        version: 0,
        content: content(),
      })
    ).rejects.toThrow("changé");
    await owner().quoteBuilder.save({
      requestId: 1,
      requestVersion: 1,
      id: saved.id,
      version: 0,
      content: { ...content(), title: "Titre mis à jour" },
    });
    await expect(
      owner().quoteBuilder.save({
        requestId: 1,
        requestVersion: 2,
        id: saved.id,
        version: 0,
        content: content(),
      })
    ).rejects.toThrow("changé");
    db.put(s.requests, [request(2)]);
    await expect(
      owner().quoteBuilder.save({
        requestId: 2,
        requestVersion: 0,
        id: saved.id,
        version: 1,
        content: content(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.put(s.requests, [request(2, { status: "in_progress" })]);
    await expect(
      owner().quoteBuilder.save({
        requestId: 2,
        requestVersion: 0,
        content: content(),
      })
    ).rejects.toThrow("état");
  });
});
describe("PDFKit réel, chiffré et immuable", () => {
  it("génère un document PDF valide, stocke uniquement le chiffré et indexe ses métadonnées privées", async () => {
    const saved = await owner().quoteBuilder.save({
      requestId: 1,
      requestVersion: 0,
      content: content(),
    });
    const generated = await owner().quoteBuilder.generate({
      id: saved.id,
      version: 0,
    });
    const doc = db.rows(s.documents)[0];
    const ciphertext = boundary.put.mock.calls[0][1];
    const pdf = decryptFile(ciphertext, doc);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-1024).toString()).toContain("%%EOF");
    expect(ciphertext.equals(pdf)).toBe(false);
    expect(boundary.put.mock.calls[0][2]).toBe("application/octet-stream");
    expect(doc).toMatchObject({
      mimeType: "application/pdf",
      kind: "quote",
      byteSize: pdf.length,
      requestId: 1,
    });
    expect(Object.keys(generated)).not.toContain("encryptionKey");
    expect(db.rows(s.quoteDrafts)[0]).toMatchObject({
      status: "generated",
      version: 1,
    });
    await expect(
      owner().quoteBuilder.save({
        requestId: 1,
        requestVersion: 2,
        id: saved.id,
        version: 1,
        content: content(),
      })
    ).rejects.toThrow("immuable");
    await expect(
      owner().quoteBuilder.generate({ id: saved.id, version: 0 })
    ).rejects.toThrow("changé");
  });
  it("40 lignes longues et conditions restent dans un vrai PDF multipage", async () => {
    const long = {
      ...content(),
      lines: Array.from({ length: 40 }, (_, n) => ({
        label: `${n + 1}. ${"Description détaillée de test. ".repeat(8)}`,
        quantity: 1,
        unitCents: 100,
        vatBasisPoints: 0,
      })),
      conditions: "Conditions de test. ".repeat(200),
      included: "Inclus dans le test. ".repeat(100),
      excluded: "Exclu du test. ".repeat(100),
    };
    const pdf = await renderQuotePdf({
      reference: "MDS-D-MULTIPAGE-TEST",
      createdAt: new Date(),
      content: long,
    });
    expect(
      pdf.toString("latin1").match(/\/Type \/Page\b/g)!.length
    ).toBeGreaterThan(3);
    expect(pdf.subarray(-1024).toString()).toContain("%%EOF");
  });
});
describe("émission et acceptation séparées", () => {
  async function generated() {
    const saved = await owner().quoteBuilder.save({
      requestId: 1,
      requestVersion: 0,
      content: content(),
    });
    await owner().quoteBuilder.generate({ id: saved.id, version: 0 });
    return saved;
  }
  it("interdit un devis généré à un autre montant et conserve son contenu émis exact", async () => {
    const saved = await generated();
    const input = {
      id: 1,
      version: 2,
      action: "quote" as const,
      proposedStart: "2030-01-02T10:00:00Z",
      priceCents: 13000,
    };
    await expect(owner().requests.artisanAction(input)).rejects.toThrow(
      "exactement"
    );
    expect(db.rows(s.quotes)).toHaveLength(0);
    expect(db.rows(s.quoteDrafts)[0].status).toBe("generated");
    await owner().requests.artisanAction({
      ...input,
      priceCents: saved.totalCents,
    });
    expect(db.rows(s.quotes)[0]).toMatchObject({
      content: content(),
      amountCents: 12000,
      issuedAt: expect.any(Date),
      status: "pending",
    });
    expect(db.rows(s.quoteDrafts)[0].status).toBe("issued");
    expect(db.rows(s.paymentPlans)).toHaveLength(0);
    expect(db.rows(s.appointments)).toHaveLength(0);
    await caller(user(2)).requests.clientAction({
      reference: "MDS-quote-test-1",
      version: 3,
      action: "acceptQuote",
    });
    expect(db.rows(s.appointments)).toHaveLength(0);
    await caller(user(2)).requests.clientAction({
      reference: "MDS-quote-test-1",
      version: 4,
      action: "confirm",
    });
    expect(db.rows(s.appointments)).toHaveLength(1);
  });
  it("devis devenu périmé avant émission rejeté, sans invention de nouvelle validité", async () => {
    await generated();
    const draft = db.rows(s.quoteDrafts)[0];
    draft.content.validUntil = "2020-01-01";
    await expect(
      owner().requests.artisanAction({
        id: 1,
        version: 2,
        action: "quote",
        proposedStart: "2030-01-02T10:00:00Z",
        priceCents: 12000,
      })
    ).rejects.toThrow("future");
    expect(db.rows(s.quotes)).toHaveLength(0);
  });
  it("PDF téléversé historique reste sous responsabilité émetteur, contenu structuré jamais inventé", async () => {
    db.put(s.documents, [
      { id: 1, requestId: 1, kind: "quote", mimeType: "application/pdf" },
    ]);
    await owner().requests.artisanAction({
      id: 1,
      version: 0,
      action: "quote",
      proposedStart: "2030-01-02T10:00:00Z",
      priceCents: 15000,
    });
    expect(db.rows(s.quotes)[0]).toMatchObject({
      content: null,
      amountCents: 15000,
    });
  });
});
