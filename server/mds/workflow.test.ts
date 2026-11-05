import { describe, expect, it } from "vitest";
import { checkVersion, isExpired, mayConfirm, overlaps, requireState, safeAnswers, slot } from "./workflow";
import { decryptFile, encryptFile, MAX_FILE_BYTES, validateFile } from "./files";
import { publicRequest } from "./common";
import { createRequestSchema, serviceSchema } from "../../shared/mds";
import type { MdsRequest } from "../../drizzle/schema";

describe("machine métier et validation", () => {
  it("refuse les transitions hors état", () => { expect(() => requireState({ status: "completed" }, ["awaiting_mds"])).toThrow("état actuel"); });
  it("refuse une version concurrente", () => { expect(() => checkVersion({ version: 4 }, 3)).toThrow("Actualisez"); expect(() => checkVersion({ version: 4 }, 4)).not.toThrow(); });
  it("un devis accepté reste distinct de la confirmation du rendez-vous", () => {
    expect(() => mayConfirm({ status: "quote_pending", quoteStatus: "pending" })).toThrow();
    expect(() => mayConfirm({ status: "awaiting_client", quoteStatus: "pending" })).toThrow("devis");
    expect(() => mayConfirm({ status: "awaiting_client", quoteStatus: "accepted" })).not.toThrow();
    expect(() => mayConfirm({ status: "proposed_slot", quoteStatus: "none" })).not.toThrow();
    expect(() => mayConfirm({ status: "to_analyze", quoteStatus: "none" })).toThrow();
  });
  it("détecte l’expiration au moment de l’accès sans expirer une intervention planifiée", () => {
    const expiresAt = new Date("2026-01-01T12:00:00Z");
    expect(isExpired({ status: "awaiting_client", expiresAt }, expiresAt)).toBe(true);
    expect(isExpired({ status: "planned", expiresAt }, expiresAt)).toBe(false);
    expect(isExpired({ status: "quote_pending", expiresAt: null }, expiresAt)).toBe(false);
  });
  it("exige prix et créneau futurs même pour une acceptation simple", () => {
    expect(() => slot(null, 10000, 60)).toThrow("créneau");
    expect(() => slot(new Date("2100-01-01"), null, 60)).toThrow("prix");
    expect(() => slot(new Date("2020-01-01"), 0, 60)).toThrow("futur");
    expect(() => slot(new Date("2100-01-01"), 1000, 1)).toThrow("durée");
    const result = slot(new Date("2030-01-01"), 0, 60, new Date("2029-01-01"));
    expect(result.endAt.getTime() - result.startAt.getTime()).toBe(3600000);
  });
  it("autorise les créneaux adjacents mais jamais les chevauchements", () => {
    const a = { startAt: new Date("2030-01-01T10:00:00Z"), endAt: new Date("2030-01-01T11:00:00Z") };
    expect(overlaps(a, { startAt: a.endAt, endAt: new Date("2030-01-01T12:00:00Z") })).toBe(false);
    expect(overlaps(a, { startAt: a.startAt, endAt: a.endAt })).toBe(true);
    expect(overlaps(a, { startAt: new Date("2030-01-01T10:30:00Z"), endAt: new Date("2030-01-01T12:00:00Z") })).toBe(true);
  });
  it("valide les réponses JSON bornées et les champs métier", () => {
    expect(() => safeAnswers(JSON.parse('{"__proto__":"bad"}'))).toThrow("invalides");
    expect(() => safeAnswers(Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`q${i}`, "a"])))).toThrow();
    expect(createRequestSchema.safeParse({}).success).toBe(false);
    expect(serviceSchema.safeParse({}).success).toBe(false);
  });
  it("ne livre aucune capability ni identifiant client interne sur les listes", () => {
    const raw = { id: 1, reference: "MDS-test", trackingHash: "secret", idempotencyHash: "secret2", payloadHash: "secret3", userId: 2, clientId: 3, consentAt: new Date(), lastAction: "internal", lastActionVersion: 4 } as MdsRequest;
    expect(publicRequest(raw)).toEqual({ id: 1, reference: "MDS-test" });
  });
});
describe("fichiers privés AES-256-GCM", () => {
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
  it("contrôle MIME, signature et base64 canonique avant transfert", () => {
    expect(validateFile(pdf.toString("base64"), "application/pdf", "quote")).toEqual(pdf);
    expect(() => validateFile(pdf.toString("base64"), "image/png", "photo")).toThrow("signature");
    expect(() => validateFile(pdf.toString("base64"), "application/pdf", "photo")).toThrow("image");
    expect(() => validateFile("invalid!", "application/pdf", "quote")).toThrow("invalide");
    expect(() => validateFile("AAAA", "text/html", "other")).toThrow("Format");
    expect(() => validateFile(Buffer.alloc(MAX_FILE_BYTES + 1).toString("base64"), "application/pdf", "other")).toThrow("5 Mo");
  });
  it("génère une clé et IV nouveaux pour chaque document, ciphertext seulement", () => {
    const a = encryptFile(pdf); const b = encryptFile(pdf);
    expect(a.encryptionKey).not.toBe(b.encryptionKey); expect(a.iv).not.toBe(b.iv);
    expect(a.encryptionKey).toHaveLength(64); expect(a.iv).toHaveLength(24); expect(a.authTag).toHaveLength(32);
    expect(a.ciphertext.equals(pdf)).toBe(false);
    expect(decryptFile(a.ciphertext, a)).toEqual(pdf);
  });
  it("refuse le déchiffrement d’octets altérés", () => {
    const a = encryptFile(pdf); a.ciphertext[0] ^= 1;
    expect(() => decryptFile(a.ciphertext, a)).toThrow();
  });
});
