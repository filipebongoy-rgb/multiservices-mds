import { z } from "zod";

export const MAX_CENTS = 100_000_000;
export const centsSchema = z.number().int().min(0).max(MAX_CENTS);
export const travelRuleSchema = z.object({
  prefix: z
    .string()
    .regex(/^\d{1,5}$/, "Un préfixe postal contient 1 à 5 chiffres."),
  feeCents: centsSchema,
});
export type TravelRule = z.infer<typeof travelRuleSchema>;
export const pricingFields = {
  pricingMode: z.enum(["fixed", "quote"]),
  included: z.string().trim().max(2000),
  excluded: z.string().trim().max(2000),
  travelMode: z.enum(["unconfigured", "included", "fixed", "postcode"]),
  travelFeeCents: centsSchema.nullable(),
  travelRules: z.array(travelRuleSchema).max(100),
};
export type PricingRules = {
  pricingMode: "fixed" | "quote";
  priceCents: number | null;
  pricingRule: string;
  included: string;
  excluded: string;
  travelMode: "unconfigured" | "included" | "fixed" | "postcode";
  travelFeeCents: number | null;
  travelRules: TravelRule[] | null;
  durationMinutes: number;
  conditions: string;
  zone: string;
};
export type PricingSnapshot = PricingRules & {
  serviceId: number | null;
  serviceName: string | null;
  revision: number;
  postcode: string | null;
  baseCents: number | null;
  travelCents: number | null;
  totalCents: number | null;
  requiresQuote: boolean;
  reason: string;
};
export type PricedService = PricingRules & {
  id: number;
  name: string;
  pricingVersion: number;
};
export function validatePricingRules(value: PricingRules) {
  const prefixes = value.travelRules?.map(rule => rule.prefix) ?? [];
  if (new Set(prefixes).size !== prefixes.length)
    return "Un préfixe postal ne peut avoir deux frais différents.";
  if (value.pricingMode === "fixed" && value.priceCents === null)
    return "Le mode prix affiché exige un prix défini.";
  if (value.travelMode === "fixed" && value.travelFeeCents === null)
    return "Renseignez les frais de déplacement fixes, y compris zéro s’ils sont nuls.";
  if (value.travelMode === "postcode" && !prefixes.length)
    return "Ajoutez au moins une règle de frais par préfixe postal.";
  return null;
}
export function calculatePricing(
  service: PricedService | null,
  postcode?: string
): PricingSnapshot {
  const rules: PricingRules = service ?? {
    pricingMode: "quote",
    priceCents: null,
    pricingRule: "Devis personnalisé après analyse de MDS.",
    included: "",
    excluded: "",
    travelMode: "unconfigured",
    travelFeeCents: null,
    travelRules: [],
    durationMinutes: 60,
    conditions: "",
    zone: "",
  };
  const snapshot: PricingSnapshot = {
    pricingMode: rules.pricingMode,
    priceCents: rules.priceCents,
    pricingRule: rules.pricingRule,
    included: rules.included,
    excluded: rules.excluded,
    travelMode: rules.travelMode,
    travelFeeCents: rules.travelFeeCents,
    travelRules: rules.travelRules ?? [],
    durationMinutes: rules.durationMinutes,
    conditions: rules.conditions,
    zone: rules.zone,
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? null,
    revision: service?.pricingVersion ?? 0,
    postcode: postcode || null,
    baseCents: null,
    travelCents: null,
    totalCents: null,
    requiresQuote: true,
    reason: "Un devis personnalisé sera préparé après analyse de votre besoin.",
  };
  if (rules.pricingMode === "quote") return snapshot;
  snapshot.baseCents = rules.priceCents;
  if (validatePricingRules(rules) || rules.priceCents === null) {
    snapshot.reason =
      "Le tarif n’est pas entièrement configuré : MDS doit établir un devis.";
    return snapshot;
  }
  if (rules.travelMode === "included") snapshot.travelCents = 0;
  else if (rules.travelMode === "fixed")
    snapshot.travelCents = rules.travelFeeCents;
  else if (rules.travelMode === "postcode") {
    const matches =
      postcode && /^\d{5}$/.test(postcode)
        ? (rules.travelRules ?? [])
            .filter(rule => postcode.startsWith(rule.prefix))
            .sort((a, b) => b.prefix.length - a.prefix.length)
        : [];
    if (matches.length) snapshot.travelCents = matches[0].feeCents;
    else {
      snapshot.reason = postcode
        ? "Aucun tarif de déplacement n’est configuré pour ce code postal. Votre demande sera étudiée sur devis, sans frais inventés."
        : "Les frais de déplacement et le total seront calculés avec votre code postal.";
      return snapshot;
    }
  } else {
    snapshot.reason =
      "Les frais de déplacement ne sont pas validés. Votre demande sera étudiée sur devis.";
    return snapshot;
  }
  if (snapshot.travelCents === null) return snapshot;
  snapshot.totalCents = rules.priceCents + snapshot.travelCents;
  snapshot.requiresQuote = false;
  snapshot.reason =
    "Prix calculé à partir des règles validées par MDS. Aucun supplément automatique.";
  return snapshot;
}
