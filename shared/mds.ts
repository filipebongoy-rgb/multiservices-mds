import { z } from "zod";
import { pricingFields, MAX_CENTS, validatePricingRules } from "./pricing";

export const trades = [
  {
    slug: "plomberie",
    name: "Plomberie",
    short: "Fuites, robinetterie, sanitaires",
    services: [
      "Fuite",
      "Débouchage",
      "Robinetterie",
      "Lavabo et évier",
      "WC",
      "Chasse d’eau",
      "Douche et baignoire",
      "Chauffe-eau",
      "Raccordements",
    ],
  },
  {
    slug: "electricite",
    name: "Électricité",
    short: "Pannes, prises, éclairage",
    services: [
      "Panne électrique",
      "Prises",
      "Interrupteurs",
      "Éclairage",
      "Tableau électrique",
      "Mise en sécurité",
      "VMC",
    ],
  },
  {
    slug: "chauffage",
    name: "Chauffage",
    short: "Radiateurs, entretien, dépannage",
    services: [
      "Panne de chauffage",
      "Radiateurs",
      "Chaudière",
      "Thermostat",
      "Entretien",
      "Circuit de chauffage",
    ],
  },
  {
    slug: "peinture",
    name: "Peinture",
    short: "Murs, plafonds, rénovation",
    services: [
      "Murs",
      "Plafonds",
      "Portes",
      "Préparation des surfaces",
      "Rebouchage",
      "Ponçage",
      "Rénovation",
    ],
  },
  {
    slug: "maintenance",
    name: "Petits travaux",
    short: "Fixations, montage, maintenance",
    services: [
      "Montage de meubles",
      "Fixations",
      "Réglages",
      "Petites réparations",
      "Entretien courant",
    ],
  },
] as const;

export const statusLabels = {
  draft: "Brouillon",
  sent: "Demande envoyée",
  awaiting_mds: "En attente de MDS",
  to_analyze: "À analyser",
  accepted_mds: "Demande acceptée par MDS",
  proposed_slot: "Proposition de nouveau créneau",
  needs_information: "Informations complémentaires demandées",
  awaiting_client: "En attente de confirmation client",
  confirmed: "Confirmée",
  refused: "Refusée",
  cancelled: "Annulée",
  planned: "Intervention planifiée",
  in_progress: "Intervention en cours",
  completed: "Intervention terminée",
  invoiced: "Facture émise",
  paid: "Paiement confirmé",
  closed: "Clôturée",
  expired: "Proposition expirée",
  quote_pending: "Devis à valider",
  quote_accepted: "Devis accepté",
  quote_refused: "Devis refusé",
} as const;
export type RequestStatus = keyof typeof statusLabels;
export const statusSchema = z.enum(
  Object.keys(statusLabels) as [RequestStatus, ...RequestStatus[]]
);
export const serviceSchema = z
  .object({
    id: z.number().int().positive().optional(),
    trade: z.enum([
      "plomberie",
      "electricite",
      "chauffage",
      "peinture",
      "maintenance",
    ]),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(600),
    photoUrl: z.string().max(1000).default(""),
    ...pricingFields,
    priceCents: z.number().int().min(0).max(MAX_CENTS).nullable(),
    pricingRule: z.string().trim().max(500).default("Sur devis après analyse"),
    durationMinutes: z.number().int().min(15).max(1440),
    questions: z.array(z.string().trim().min(1).max(200)).max(10),
    problemTypes: z.array(z.string().trim().min(1).max(120)).max(20),
    conditions: z.string().trim().max(1000),
    zone: z.string().trim().max(300),
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const issue = validatePricingRules(value);
    if (issue)
      ctx.addIssue({ code: "custom", message: issue, path: ["pricingMode"] });
    if (
      value.active &&
      value.pricingMode === "fixed" &&
      (!value.included ||
        !value.excluded ||
        !value.conditions ||
        value.travelMode === "unconfigured")
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Avant activation du prix affiché, précisez inclusions, exclusions, conditions et frais de déplacement.",
        path: ["active"],
      });
  });
export const createRequestSchema = z.object({
  serviceId: z.number().int().positive().nullable(),
  pricingFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .default(null),
  problemType: z.string().max(120).default(""),
  description: z
    .string()
    .trim()
    .min(10, "Décrivez votre problème en quelques mots.")
    .max(5000),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(320),
  phone: z.string().trim().min(8).max(30),
  address: z.string().trim().min(5).max(250),
  postcode: z.string().regex(/^\d{5}$/, "Code postal à 5 chiffres"),
  city: z.string().trim().min(2).max(100),
  desiredStart: z.string().datetime({ offset: true }).nullable(),
  organizationId: z.number().int().positive().nullable().default(null),
  siteId: z.number().int().positive().nullable().default(null),
  answers: z.record(z.string(), z.string().max(1000)).default({}),
  consent: z.literal(true),
  idempotencyKey: z.string().min(16).max(80),
});
export const artisanActionSchema = z.object({
  id: z.number().int().positive(),
  version: z.number().int().min(0),
  action: z.enum([
    "accept",
    "refuse",
    "propose",
    "information",
    "quote",
    "start",
    "complete",
    "cancel",
    "invoice",
    "paid",
    "close",
  ]),
  proposedStart: z.string().datetime({ offset: true }).optional(),
  priceCents: z.number().int().min(0).max(MAX_CENTS).optional(),
  durationMinutes: z.number().int().min(15).max(1440).optional(),
  message: z.string().trim().max(3000).optional(),
});
export const trackSchema = z.object({
  reference: z.string().min(4).max(40),
  token: z.string().min(16).max(100).optional(),
});
export const clientActionSchema = trackSchema.extend({
  version: z.number().int().min(0),
  action: z.enum([
    "confirm",
    "refuse",
    "reschedule",
    "information",
    "acceptQuote",
    "refuseQuote",
    "cancel",
  ]),
  message: z.string().trim().max(3000).optional(),
  desiredStart: z.string().datetime({ offset: true }).optional(),
});
export function money(cents: number | null | undefined) {
  return cents == null
    ? "Sur devis"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(cents / 100);
}
export function dateTime(value: Date | string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(new Date(value))
    : "À convenir avec MDS";
}
