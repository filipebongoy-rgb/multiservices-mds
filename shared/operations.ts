import { z } from "zod";
import { MAX_CENTS } from "./pricing";

export const weeklyWindowSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine(v => v.start < v.end, "L’heure de fin doit suivre l’heure de début.");
export const travelZoneSchema = z.object({
  prefix: z.string().regex(/^\d{1,5}$/),
  travelMinutes: z.number().int().min(0).max(360),
});
export type WeeklyWindow = z.infer<typeof weeklyWindowSchema>;
export type TravelZone = z.infer<typeof travelZoneSchema>;
export const calendarSettingsSchema = z
  .object({
    enabled: z.boolean(),
    timezone: z.literal("Europe/Paris"),
    weeklyWindows: z.array(weeklyWindowSchema).max(35),
    travelZones: z.array(travelZoneSchema).max(100),
    bufferMinutes: z.number().int().min(0).max(180),
    horizonDays: z.number().int().min(1).max(365),
  })
  .superRefine((v, ctx) => {
    if (v.enabled && (!v.weeklyWindows.length || !v.travelZones.length))
      ctx.addIssue({
        code: "custom",
        message:
          "Configurez les horaires et les zones avant d’activer le calendrier.",
      });
    if (new Set(v.travelZones.map(r => r.prefix)).size !== v.travelZones.length)
      ctx.addIssue({
        code: "custom",
        message: "Deux règles de zone utilisent le même préfixe.",
      });
  });
export const alternativeSlotSchema = z.object({
  id: z.string().min(1).max(80),
  startAt: z.string().datetime({ offset: true }),
});
export type AlternativeSlot = z.infer<typeof alternativeSlotSchema>;
export const incidentKindSchema = z.enum([
  "problem",
  "no_slot",
  "client_absent",
  "artisan_unavailable",
  "complaint",
  "payment_failed",
]);
export const incidentSchema = z.object({
  requestId: z.number().int().positive(),
  version: z.number().int().min(0),
  kind: incidentKindSchema,
  message: z.string().trim().min(5).max(3000),
});
export const extraWorkSchema = z.object({
  requestId: z.number().int().positive(),
  version: z.number().int().min(0),
  scope: z.string().trim().min(10).max(3000),
  amountCents: z.number().int().min(0).max(MAX_CENTS),
  durationMinutes: z.number().int().min(1).max(1440),
  conditions: z.string().trim().min(5).max(3000),
  documentId: z.number().int().positive().nullable().default(null),
});
export const quoteLineSchema = z.object({
  label: z.string().trim().min(2).max(300),
  quantity: z.number().int().min(1).max(10000),
  unitCents: z.number().int().min(0).max(MAX_CENTS),
  vatBasisPoints: z.number().int().min(0).max(10000),
});
export type QuoteLine = z.infer<typeof quoteLineSchema>;
export const quoteContentSchema = z.object({
  issuerName: z.string().trim().min(2).max(200),
  issuerAddress: z.string().trim().min(5).max(500),
  issuerRegistration: z.string().trim().min(3).max(200),
  issuerEmail: z.email().max(320),
  issuerPhone: z.string().trim().min(8).max(30),
  clientName: z.string().trim().min(2).max(200),
  clientAddress: z.string().trim().min(5).max(500),
  title: z.string().trim().min(5).max(300),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(quoteLineSchema).min(1).max(40),
  included: z.string().trim().min(3).max(3000),
  excluded: z.string().trim().min(3).max(3000),
  conditions: z.string().trim().min(5).max(5000),
  paymentTerms: z.string().trim().min(5).max(2000),
  depositCents: z.number().int().min(0).max(MAX_CENTS),
  taxNote: z.string().trim().min(3).max(1000),
  insuranceNote: z.string().trim().min(3).max(2000),
});
export type QuoteContent = z.infer<typeof quoteContentSchema>;
export function quoteTotals(lines: QuoteLine[]) {
  let netCents = 0,
    vatCents = 0;
  for (const line of lines) {
    const net = line.quantity * line.unitCents;
    if (!Number.isSafeInteger(net) || net > MAX_CENTS)
      throw new Error("Montant de ligne trop élevé.");
    const tax = Math.floor((net * line.vatBasisPoints + 5000) / 10000);
    netCents += net;
    vatCents += tax;
  }
  const totalCents = netCents + vatCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > MAX_CENTS)
    throw new Error("Montant de devis trop élevé.");
  return { netCents, vatCents, totalCents };
}
export const qualificationSchema = z.object({
  description: z.string().trim().min(10).max(3000),
  serviceId: z.number().int().positive().nullable().default(null),
  answers: z.record(z.string(), z.string().max(500)).default({}),
  consent: z.literal(true),
});
export const qualificationResultSchema = z.object({
  serviceId: z.number().int().positive().nullable(),
  trade: z
    .enum(["plomberie", "electricite", "chauffage", "peinture", "maintenance"])
    .nullable(),
  confidence: z.enum(["probable", "uncertain"]),
  question: z.string().max(200).nullable(),
  missingInformation: z.array(z.string().max(120)).max(5),
  summary: z.string().max(500),
});
export type QualificationResult = z.infer<typeof qualificationResultSchema>;
