import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import * as s from "../../drizzle/schema";
import { calculatePricing, type PricingRules } from "../../shared/pricing";
import { hash, type SqlDb } from "./common";
import { fail } from "./workflow";

export const catalogPricingSchema = z.object({
  serviceId: z.number().int().positive().nullable(),
  postcode: z.string().regex(/^\d{5}$/, "Code postal à 5 chiffres").optional(),
});

// Normalize only the API view; never erase the administrator's legacy DB values.
export function normalizeService(row: typeof s.services.$inferSelect) {
  return { ...row, included: row.included ?? "", excluded: row.excluded ?? "", travelRules: row.travelRules ?? [] };
}

// Stable key order deliberately matches the complete shared PricingRules contract.
export function pricingConfiguration(value: PricingRules): PricingRules {
  return {
    pricingMode: value.pricingMode, priceCents: value.priceCents, pricingRule: value.pricingRule,
    included: value.included ?? "", excluded: value.excluded ?? "", travelMode: value.travelMode,
    travelFeeCents: value.travelFeeCents, travelRules: value.travelRules ?? [],
    durationMinutes: value.durationMinutes, conditions: value.conditions, zone: value.zone,
  };
}

export async function resolvePricing(db: SqlDb, serviceId: number | null, postcode?: string) {
  let service: ReturnType<typeof normalizeService> | null = null;
  if (serviceId !== null) {
    const [row] = await db.select().from(s.services).where(and(eq(s.services.id, serviceId), eq(s.services.active, true), isNull(s.services.deletedAt)));
    if (!row) fail("Cette prestation n’est pas proposée actuellement. Vous pouvez déposer une demande libre.", "NOT_FOUND");
    service = normalizeService(row);
  }
  const snapshot = calculatePricing(service, postcode);
  return { service, snapshot, fingerprint: hash(JSON.stringify(snapshot)) };
}

// Historic rows with a null snapshot retain their existing workflow. New rows must
// honor the immutable displayed total, or go through a real accepted custom quote.
export function requireContractPrice(request: Pick<s.MdsRequest, "pricingSnapshot" | "quoteStatus" | "proposedPriceCents">, price: number | null) {
  if (request.quoteStatus === "accepted") {
    if (price !== request.proposedPriceCents) fail("Le prix du devis accepté ne peut pas être modifié sans nouveau devis.", "CONFLICT");
    return;
  }
  if (!request.pricingSnapshot) return;
  if (request.pricingSnapshot.requiresQuote) fail("Ce dossier exige un vrai devis personnalisé accepté séparément avant l’accord ou la confirmation. Utilisez l’action devis.", "CONFLICT");
  if (price !== request.pricingSnapshot.totalCents) fail("Le prix annoncé ne peut pas être modifié. Ajoutez un nouveau devis réel à accepter par le client.", "CONFLICT");
}
