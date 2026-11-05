import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { calculatePricing } from "../../shared/pricing";
import { serviceSchema } from "../../shared/mds";
import { hash } from "./common";
import { pricingConfiguration } from "./tariffs";
const boundary = vi.hoisted(() => ({ db: null as any }));
vi.mock("../db", () => ({ getDb: async () => boundary.db }));
import { mdsRouter } from "./router";
const db = new MockDatabase();
const user = (id: number, role: "user" | "admin" = "user"): s.User => ({ id, openId: `tariff-test-${id}`, role, name: `Test ${id}`, email: `u${id}@example.test`, loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
const caller = (u: s.User | null = null) => mdsRouter.createCaller({ user: u, req: { headers: {} } as any, res: { set: vi.fn() } as any } as TrpcContext);
type ServiceInput = z.infer<typeof serviceSchema>;
const config: ServiceInput = {
  id: 1, trade: "plomberie", name: "Prestation test en mémoire", description: "Description de test uniquement",
  photoUrl: "", pricingMode: "fixed", priceCents: 12000, pricingRule: "Forfait de test configuré",
  included: "Main-d’œuvre définie", excluded: "Pièces non incluses", travelMode: "fixed", travelFeeCents: 1500,
  travelRules: [], durationMinutes: 90, conditions: "Selon périmètre défini", zone: "Zone de test",
  questions: [], problemTypes: [], active: true,
};
function service(patch: Partial<typeof s.services.$inferSelect> = {}): typeof s.services.$inferSelect {
  return { ...config, id: 1, seedKey: null, pricingVersion: 1, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...patch };
}
const input = (patch = {}) => ({ serviceId: 1, description: "Une demande de réparation de test", name: "Client test", email: "u2@example.test", phone: "0102030405", address: "1 rue du test", postcode: "75001", city: "Paris", desiredStart: "2030-01-01T10:00:00Z", consent: true as const, idempotencyKey: "tariff-idem-at-least-16", ...patch });
function request(patch: Partial<s.MdsRequest> = {}): s.MdsRequest {
  return { id: 1, reference: "MDS-tariff-test", trackingHash: hash("private-test-token"), idempotencyHash: "idem", payloadHash: "payload", userId: 2, clientId: 1, serviceId: 1, serviceName: config.name, description: "Une réparation de test", problemType: "", name: "Client test", email: "u2@example.test", phone: "0102030405", address: "1 rue du test", postcode: "75001", city: "Paris", desiredStart: new Date("2030-01-01T10:00:00Z"), organizationId: null, siteId: null, pricingSnapshot: calculatePricing(service(), "75001"), answers: {}, consentAt: new Date(), status: "awaiting_mds", version: 0, proposedStart: new Date("2030-01-01T10:00:00Z"), proposedPriceCents: 13500, durationMinutes: 90, proposalMessage: null, expiresAt: new Date("2030-02-01"), quoteStatus: "none", lastAction: null, lastActionVersion: null, createdAt: new Date(), updatedAt: new Date(), ...patch };
}
beforeEach(() => {
  vi.useRealTimers(); db.clear(); boundary.db = db;
  db.put(s.settings, [{ id: 1, trackingSecret: "d".repeat(64), artisanUserId: 1, proposalExpiryHours: 72 }]);
  db.put(s.users, [user(1, "admin"), user(2)]); db.put(s.services, [service()]);
});

async function createSelected() {
  const { fingerprint } = await caller().catalog.pricing({ serviceId: 1, postcode: "75001" });
  return caller(user(2)).requests.create({ ...input(), pricingFingerprint: fingerprint });
}

describe("API catalogue et calcul déterministe partagé", () => {
  it("retourne exactement snapshot + empreinte SHA-256, sans calcul client", async () => {
    const result = await caller().catalog.pricing({ serviceId: 1, postcode: "75001" });
    expect(Object.keys(result)).toEqual(["snapshot", "fingerprint"]);
    expect(result.snapshot).toEqual(calculatePricing(service(), "75001"));
    expect(result.snapshot).toMatchObject({ baseCents: 12000, travelCents: 1500, totalCents: 13500, requiresQuote: false, included: config.included, excluded: config.excluded, durationMinutes: 90, revision: 1 });
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/); expect(result.fingerprint).toBe(hash(JSON.stringify(result.snapshot)));
  });
  it("la demande libre n’a aucun faux prix", async () => {
    const result = await caller().catalog.pricing({ serviceId: null });
    expect(result.snapshot).toEqual(calculatePricing(null));
    expect(result.snapshot).toMatchObject({ serviceId: null, requiresQuote: true, totalCents: null });
  });
  it.each([{ active: false }, { deletedAt: new Date() }])("refuse une offre indisponible %o", async patch => {
    db.put(s.services, [service(patch)]);
    await expect(caller().catalog.pricing({ serviceId: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("rejette les codes postaux non composés de cinq chiffres", async () => {
    await expect(caller().catalog.pricing({ serviceId: 1, postcode: "7500" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("normalise les nullable du catalogue sans effacer leurs valeurs DB", async () => {
    db.put(s.services, [service({ included: null, excluded: null, travelRules: null })]);
    const [result] = await caller().catalog.list();
    expect(result).toMatchObject({ included: "", excluded: "", travelRules: [] });
    expect(db.rows(s.services)[0]).toMatchObject({ included: null, excluded: null, travelRules: null });
    expect(result).not.toHaveProperty("seedKey"); expect(result).not.toHaveProperty("deletedAt");
  });
  it("sélectionne le préfixe le plus spécifique depuis les règles admin", async () => {
    db.put(s.services, [service({ travelMode: "postcode", travelFeeCents: null, travelRules: [{ prefix: "75", feeCents: 2500 }, { prefix: "750", feeCents: 1800 }, { prefix: "75001", feeCents: 900 }] })]);
    const { snapshot } = await caller().catalog.pricing({ serviceId: 1, postcode: "75001" });
    expect(snapshot).toMatchObject({ totalCents: 12900, travelCents: 900, requiresQuote: false });
  });
  it("un code postal non couvert exige un devis sans inventer de déplacement", async () => {
    db.put(s.services, [service({ travelMode: "postcode", travelRules: [{ prefix: "75", feeCents: 500 }] })]);
    const { snapshot } = await caller().catalog.pricing({ serviceId: 1, postcode: "69001" });
    expect(snapshot).toMatchObject({ travelCents: null, totalCents: null, requiresQuote: true });
  });
  it("mode devis : garde les métadonnées historiques, mais aucun prix ferme calculé", async () => {
    db.put(s.services, [service({ pricingMode: "quote" })]);
    const { snapshot } = await caller().catalog.pricing({ serviceId: 1, postcode: "75001" });
    expect(snapshot).toMatchObject({ pricingMode: "quote", priceCents: 12000, baseCents: null, travelCents: null, totalCents: null, requiresQuote: true, included: config.included, travelFeeCents: 1500 });
    await createSelected(); expect(db.rows(s.requests)[0].proposedPriceCents).toBeNull();
    expect(db.rows(s.services)[0].priceCents).toBe(12000);
  });
});

describe("dépôt : empreinte, immutabilité et idempotence", () => {
  it("fige le total et la durée et ne passe jamais pricingFingerprint à SQL", async () => {
    await createSelected(); const r = db.rows(s.requests)[0];
    expect(r).toMatchObject({ proposedPriceCents: 13500, durationMinutes: 90, status: "awaiting_mds", pricingSnapshot: { totalCents: 13500, revision: 1 } });
    expect(r).not.toHaveProperty("pricingFingerprint"); expect(db.rows(s.clients)).toHaveLength(1);
  });
  it.each([null, "a".repeat(64)])("une empreinte absente/incorrecte %s ne crée aucun client", async pricingFingerprint => {
    await expect(caller(user(2)).requests.create({ ...input(), pricingFingerprint })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows(s.clients)).toHaveLength(0); expect(db.rows(s.requests)).toHaveLength(0); expect(db.rows(s.events)).toHaveLength(0);
  });
  it("changement de configuration depuis le récapitulatif : CONFLICT avant toute écriture", async () => {
    const { fingerprint } = await caller().catalog.pricing({ serviceId: 1, postcode: "75001" });
    await caller(user(1, "admin")).catalog.save({ ...config, included: "Périmètre différent" });
    await expect(caller(user(2)).requests.create({ ...input(), pricingFingerprint: fingerprint })).rejects.toThrow("Relisez");
    expect(db.rows(s.clients)).toHaveLength(0); expect(db.rows(s.requests)).toHaveLength(0);
  });
  it("un retry identique réussit même après changement, désactivation et créneau passé", async () => {
    const { fingerprint } = await caller().catalog.pricing({ serviceId: 1, postcode: "75001" });
    const submitted = { ...input(), pricingFingerprint: fingerprint };
    const first = await caller(user(2)).requests.create(submitted);
    await caller(user(1, "admin")).catalog.save({ ...config, priceCents: 19000, active: false });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2031-01-01"));
    try { expect(await caller(user(2)).requests.create(submitted)).toEqual(first); } finally { vi.useRealTimers(); }
    expect(db.rows(s.requests)).toHaveLength(1); expect(db.rows(s.clients)).toHaveLength(1);
    await expect(caller(user(2)).requests.create({ ...submitted, pricingFingerprint: "a".repeat(64) })).rejects.toThrow("autre demande");
  });
  it("fige aussi les demandes libres, sans prix et sans exigence d’empreinte", async () => {
    await caller(user(2)).requests.create(input({ serviceId: null }));
    expect(db.rows(s.requests)[0]).toMatchObject({ status: "to_analyze", proposedPriceCents: null, pricingSnapshot: { serviceId: null, requiresQuote: true, totalCents: null } });
  });
  it("les anciens dossiers gardent montant et snapshot malgré les futurs prix catalogue", async () => {
    const { id } = await createSelected(); const frozen = structuredClone(db.rows(s.requests)[0].pricingSnapshot);
    await caller(user(1, "admin")).catalog.save({ ...config, priceCents: 50000, durationMinutes: 120, included: "Nouveau périmètre" });
    await caller(user(1, "admin")).requests.artisanAction({ id, version: 0, action: "accept" });
    expect(db.rows(s.requests)[0]).toMatchObject({ proposedPriceCents: 13500, durationMinutes: 90 });
    expect(db.rows(s.requests)[0].pricingSnapshot).toEqual(frozen);
  });
});

describe("révisions et historique complet de PricingRules", () => {
  const changes: Partial<ServiceInput>[] = [
    { priceCents: 12001 }, { pricingMode: "quote" }, { pricingRule: "Autre règle" },
    { included: "Autre inclusion" }, { excluded: "Autre exclusion" }, { conditions: "Autres conditions" },
    { durationMinutes: 120 }, { zone: "Autre zone" }, { travelMode: "included" },
    { travelFeeCents: 2000 }, { travelRules: [{ prefix: "75", feeCents: 900 }] },
  ];
  it.each(changes)("révise la configuration entière %o et ferme le tarif précédent", async change => {
    db.put(s.tariffs, [{ id: 1, serviceId: 1, priceCents: 12000, rule: config.pricingRule, configuration: pricingConfiguration(config), validUntil: null }]);
    const saved = await caller(user(1, "admin")).catalog.save({ ...config, ...change });
    expect(saved.pricingVersion).toBe(2); expect(db.rows(s.tariffs)).toHaveLength(2);
    expect(db.rows(s.tariffs)[0].validUntil).toBeInstanceOf(Date);
    expect(db.rows(s.tariffs)[1].configuration).toEqual(pricingConfiguration({ ...config, ...change }));
    expect(db.rows(s.tariffs)[1].validFrom).toEqual(db.rows(s.tariffs)[0].validUntil);
  });
  it("ne révise pas un tarif inchangé ou une simple description", async () => {
    await caller(user(1, "admin")).catalog.save(config);
    await caller(user(1, "admin")).catalog.save({ ...config, description: "Autre texte sans effet tarifaire" });
    expect(db.rows(s.services)[0].pricingVersion).toBe(1); expect(db.rows(s.tariffs)).toHaveLength(0);
  });
  it("crée le premier tarif complet d’une prestation inactive", async () => {
    const saved = await caller(user(1, "admin")).catalog.save({ ...config, id: undefined, active: false });
    expect(saved).toMatchObject({ active: false, pricingVersion: 1 });
    expect(db.rows(s.tariffs)[0].configuration).toEqual(pricingConfiguration(config));
  });
  it("passer sur devis puis revenir au forfait préserve les champs admin réels", async () => {
    const quote = await caller(user(1, "admin")).catalog.save({ ...config, pricingMode: "quote" });
    expect(quote).toMatchObject({ pricingMode: "quote", priceCents: 12000, travelFeeCents: 1500, included: config.included, excluded: config.excluded });
    const fixed = await caller(user(1, "admin")).catalog.save(config);
    expect(fixed).toMatchObject({ pricingMode: "fixed", priceCents: 12000, pricingVersion: 3, conditions: config.conditions });
  });
  it.each([{ included: "" }, { excluded: "" }, { conditions: "" }, { conditions: "   " }, { travelMode: "unconfigured" as const }, { travelMode: "postcode" as const, travelRules: [] }])("activation forfait invalide %o rejetée", async invalid => {
    await expect(caller(user(1, "admin")).catalog.save({ ...config, ...invalid })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.rows(s.tariffs)).toHaveLength(0);
  });
});

describe("accords : aucun supplément silencieux ni contournement du devis", () => {
  it.each(["accept", "propose"] as const)("un forfait interdit un autre prix dans %s", async action => {
    db.put(s.requests, [request()]);
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action, priceCents: 14000, proposedStart: "2030-01-01T10:00:00Z" })).rejects.toThrow("nouveau devis réel");
    expect(db.rows(s.requests)[0].version).toBe(0); expect(db.rows(s.events)).toHaveLength(0);
  });
  it.each(["accept", "propose"] as const)("une nouvelle demande sur devis interdit %s même avec montant saisi", async action => {
    db.put(s.requests, [request({ pricingSnapshot: calculatePricing(null), proposedPriceCents: null })]);
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action, priceCents: 14000, proposedStart: "2030-01-01T10:00:00Z" })).rejects.toThrow("vrai devis personnalisé");
    expect(db.rows(s.events)).toHaveLength(0);
  });
  it("ne confirme pas un snapshot sur devis sans devis accepté", async () => {
    db.put(s.requests, [request({ status: "awaiting_client", pricingSnapshot: calculatePricing(null), proposedPriceCents: 14000 })]);
    await expect(caller(user(2)).requests.clientAction({ reference: "MDS-tariff-test", version: 0, action: "confirm" })).rejects.toThrow("vrai devis personnalisé");
    expect(db.rows(s.appointments)).toHaveLength(0);
  });
  it("refuse aussi un prix forfait déjà altéré au moment de confirmer", async () => {
    db.put(s.requests, [request({ status: "awaiting_client", proposedPriceCents: 14000 })]);
    await expect(caller(user(2)).requests.clientAction({ reference: "MDS-tariff-test", version: 0, action: "confirm" })).rejects.toThrow("prix annoncé");
  });
  it("permet un nouveau prix seulement par vrai document + devis accepté + confirmation", async () => {
    const frozen = request().pricingSnapshot; db.put(s.requests, [request()]);
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "quote", priceCents: 24000 })).rejects.toThrow("vrai document");
    db.put(s.documents, [{ id: 10, requestId: 1, kind: "quote" }]);
    await caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "quote", priceCents: 24000 });
    expect(db.rows(s.requests)[0]).toMatchObject({ proposedPriceCents: 24000, quoteStatus: "pending" });
    await caller(user(2)).requests.clientAction({ reference: "MDS-tariff-test", version: 1, action: "acceptQuote" });
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 2, action: "accept", priceCents: 24500 })).rejects.toThrow("devis accepté");
    await caller(user(2)).requests.clientAction({ reference: "MDS-tariff-test", version: 2, action: "confirm" });
    expect(db.rows(s.requests)[0].pricingSnapshot).toEqual(frozen);
    expect(db.rows(s.appointments)).toHaveLength(1);
  });
  it("sur devis personnalisé, seul le prix manuel réellement proposé est contractualisé", async () => {
    db.put(s.requests, [request({ pricingSnapshot: calculatePricing(null), proposedPriceCents: null })]);
    db.put(s.documents, [{ id: 10, requestId: 1, kind: "quote" }]);
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "quote" })).rejects.toThrow("prix explicite");
    await caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "quote", priceCents: 16000 });
    await caller(user(2)).requests.clientAction({ reference: "MDS-tariff-test", version: 1, action: "acceptQuote" });
    await caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 2, action: "accept" });
    expect(db.rows(s.requests)[0].proposedPriceCents).toBe(16000);
    await caller(user(2)).requests.clientAction({ reference: "MDS-tariff-test", version: 3, action: "confirm" });
    expect(db.rows(s.appointments)).toHaveLength(1);
  });
  it("les demandes historiques snapshot null gardent le flux sans prix inventé", async () => {
    db.put(s.requests, [request({ pricingSnapshot: null, proposedPriceCents: null })]);
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "accept" })).rejects.toThrow("prix explicite");
    await caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "accept", priceCents: 17000 });
    expect(db.rows(s.requests)[0]).toMatchObject({ proposedPriceCents: 17000, pricingSnapshot: null });
  });
});

describe("facture et registre du paiement manuel", () => {
  it("montant contractuel réel EUR, puis paiement offline vérifié distinct", async () => {
    db.put(s.requests, [request({ status: "completed" })]); db.put(s.documents, [{ id: 10, requestId: 1, kind: "invoice" }]);
    await caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "invoice", priceCents: 99000 });
    expect(db.rows(s.invoices)[0]).toMatchObject({ amountCents: 13500, currency: "EUR", paidAt: null });
    await caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 1, action: "paid", message: "Virement reçu vérifié sur relevé" });
    expect(db.rows(s.payments)).toHaveLength(1);
    expect(db.rows(s.payments)[0]).toMatchObject({ provider: "manual", mode: "offline", status: "succeeded", amountCents: 13500, currency: "EUR", verifiedBy: 1, verificationNote: "Virement reçu vérifié sur relevé", invoiceId: 1, requestId: 1, checkoutSessionId: null, paymentIntentId: null });
    expect(db.rows(s.payments)[0].confirmedAt).toEqual(db.rows(s.invoices)[0].paidAt);
    expect(db.rows(s.requests)[0].status).toBe("paid");
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 1, action: "paid", message: "Retry" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows(s.payments)).toHaveLength(1);
  });
  it("refuse une facture sans montant contractuel même historique", async () => {
    db.put(s.requests, [request({ status: "completed", proposedPriceCents: null, pricingSnapshot: null })]); db.put(s.documents, [{ id: 10, requestId: 1, kind: "invoice" }]);
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "invoice" })).rejects.toThrow("montant contractuel");
    expect(db.rows(s.invoices)).toHaveLength(0);
  });
  it.each([{ amountCents: null, currency: "EUR" }, { amountCents: 12000, currency: "EUR" }, { amountCents: 13500, currency: "USD" }])("refuse de fabriquer un paiement à partir d’une facture invalide %o", async invoice => {
    db.put(s.requests, [request({ status: "invoiced" })]); db.put(s.invoices, [{ id: 1, requestId: 1, documentId: 10, paidAt: null, ...invoice }]);
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "paid", message: "Virement vérifié" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows(s.payments)).toHaveLength(0); expect(db.rows(s.invoices)[0].paidAt).toBeNull(); expect(db.rows(s.requests)[0].status).toBe("invoiced");
  });
  it.each(["pending", "failed"] as const)("Stripe live %s réutilisable interdit le manuel et conserve le dossier/la facture", async status => {
    db.put(s.requests, [request({ status: "invoiced" })]); db.put(s.invoices, [{ id: 1, requestId: 1, amountCents: 13500, currency: "EUR", paidAt: null }]);
    db.put(s.payments, [{ id: 10, invoiceId: 1, requestId: 1, provider: "stripe", mode: "live", status, amountCents: 13500, currency: "EUR" }]);
    await expect(caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "paid", message: "Virement vérifié" })).rejects.toThrow("double règlement");
    expect(db.rows(s.payments)).toHaveLength(1); expect(db.rows(s.invoices)[0].paidAt).toBeNull(); expect(db.rows(s.events)).toHaveLength(0); expect(db.rows(s.requests)[0].status).toBe("invoiced");
  });
  it.each(["test", "live"] as const)("autorise le manuel pour un Stripe %s non réel/non actif", async mode => {
    db.put(s.requests, [request({ status: "invoiced" })]); db.put(s.invoices, [{ id: 1, requestId: 1, amountCents: 13500, currency: "EUR", paidAt: null }]);
    db.put(s.payments, [{ id: 10, invoiceId: 1, requestId: 1, provider: "stripe", mode, status: mode === "test" ? "pending" : "expired", amountCents: 13500, currency: "EUR" }]);
    await caller(user(1, "admin")).requests.artisanAction({ id: 1, version: 0, action: "paid", message: "Virement vérifié" });
    expect(db.rows(s.payments)).toHaveLength(2); expect(db.rows(s.payments)[1]).toMatchObject({ provider: "manual", mode: "offline", status: "succeeded", amountCents: 13500 });
  });
});
