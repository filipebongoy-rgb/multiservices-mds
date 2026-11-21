import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import { artisan, dbRequired, event, principal, recordAudit, requireAdmin } from "./common";
import { fail } from "./workflow";
import { processOutbox, providerReadiness } from "./outbox";
import { createOutboundVoiceCall, voiceProviderReadiness } from "./voice-agent";
import {
  followUpDate,
  followUpPresets,
  scheduleFollowUp,
  unscheduleFollowUp,
} from "./followups";
import { autoConfirmRequest } from "./requests";
import { quoteContentSchema, quoteTotals } from "../../shared/operations";

const assistantModel = "gpt-5-mini";
const draftSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2400),
});
const draftInput = z.object({
  requestId: z.number().int().positive(),
  actionType: z.enum([
    "follow_up",
    "quote_review",
    "invoice_review",
    "appointment_confirmation",
    "call_script",
  ]),
  channel: z.enum(["email", "sms", "call"]),
});

type AssistantTask = {
  id: string;
  kind: "request" | "appointment" | "quote" | "invoice" | "payment" | "message" | "incident";
  priority: "urgent" | "today" | "follow_up";
  title: string;
  detail: string;
  requestId: number | null;
  reference: string | null;
  clientName: string | null;
  dueAt: Date | null;
  actionLabel: string;
  autoConfirmable?: boolean;
  autoQuoteable?: boolean;
  autoValidateable?: boolean;
  assignedTo?: string | null;
};

function parisDay(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function actionLabel(actionType: z.infer<typeof draftInput>["actionType"]) {
  return {
    follow_up: "Relance client",
    quote_review: "Devis à vérifier",
    invoice_review: "Facture à contrôler",
    appointment_confirmation: "Confirmation de rendez-vous",
    call_script: "Script d’appel",
  }[actionType];
}

function provisionalQuoteCents(
  trade: string | null | undefined,
  durationMinutes: number | null | undefined,
) {
  const hourlyRates: Record<string, number> = {
    plomberie: 8500,
    electricite: 9000,
    chauffage: 9500,
    peinture: 7500,
    maintenance: 7000,
  };
  const hourly = hourlyRates[trade || ""] ?? 8000;
  const duration = Math.max(60, Math.min(durationMinutes || 60, 480));
  return Math.ceil((hourly * duration) / 60 / 500) * 500;
}

function inferTrade(request: typeof s.requests.$inferSelect) {
  const text = `${request.serviceName || ""} ${request.problemType || ""} ${request.description || ""}`.toLocaleLowerCase("fr-FR");
  if (/plomb|fuite|robinet|évier|evier|wc|douche|chauffe-eau/.test(text)) return "plomberie";
  if (/électric|electric|prise|interrupteur|tableau|vmc|éclairage|eclairage/.test(text)) return "electricite";
  if (/chauffage|chaudière|chaudiere|radiateur|thermostat/.test(text)) return "chauffage";
  if (/peinture|mur|plafond|porte|ponçage|poncage|enduit/.test(text)) return "peinture";
  return "maintenance";
}

function paymentReason(reason: string | null, status: string) {
  const value = (reason || status).toLocaleLowerCase("fr-FR");
  if (value.includes("insufficient") || value.includes("fonds insuffisants")) {
    return "La carte du client a été refusée par sa banque : fonds insuffisants.";
  }
  if (value.includes("expired")) return "La carte du client est expirée. Contactez le client.";
  if (value.includes("declined") || value.includes("refus")) {
    return "Le paiement du client a été refusé par sa banque. Contactez le client.";
  }
  if (value.includes("cancel")) return "Le paiement a été annulé. Vérifiez avec le client.";
  return "Le paiement n’a pas abouti. Vérifiez le dossier et contactez le client.";
}

function fallbackDraft(
  request: typeof s.requests.$inferSelect,
  actionType: z.infer<typeof draftInput>["actionType"],
  channel: z.infer<typeof draftInput>["channel"]
) {
  const name = request.name.trim().split(/\s+/)[0] || "Bonjour";
  const subject = `${actionLabel(actionType)} · ${request.reference}`;
  const service = request.serviceName || request.problemType || "votre demande";
  const body =
    actionType === "call_script"
      ? `Bonjour ${name}, je vous appelle au sujet de votre demande MDS ${request.reference} concernant ${service}. Je vais vérifier avec vous les prochaines étapes et le créneau souhaité.`
      : `Bonjour ${name},\n\nNous revenons vers vous au sujet de votre demande MDS ${request.reference} concernant ${service}. Nous vous confirmons les prochaines étapes après vérification de votre dossier.\n\nCordialement,\nMULTISERVICES MDS`;
  return {
    subject: channel === "sms" ? subject.slice(0, 120) : subject,
    body: body.slice(0, 2400),
  };
}

async function createDraftWithAi(
  request: typeof s.requests.$inferSelect,
  actionType: z.infer<typeof draftInput>["actionType"],
  channel: z.infer<typeof draftInput>["channel"]
) {
  const fallback = fallbackDraft(request, actionType, channel);
  try {
    const completion = await invokeLLM({
      model: assistantModel,
      reasoning: { effort: "low" },
      max_completion_tokens: 900,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mds_assistant_draft",
          strict: true,
          schema: {
            type: "object",
            properties: {
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["subject", "body"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Tu es l’assistante administrative de MULTISERVICES MDS. Rédige un brouillon court en français, jamais un diagnostic et jamais une promesse. Utilise uniquement les faits fournis. N’invente ni prix, ni disponibilité, ni délai, ni engagement juridique. N’ajoute aucun lien, aucune coordonnée et aucune instruction technique. Le brouillon sera relu et validé par l’artisan avant tout envoi. Retourne uniquement le JSON demandé.",
        },
        {
          role: "user",
          content: JSON.stringify({
            actionType,
            channel,
            reference: request.reference,
            clientFirstName: request.name.trim().split(/\s+/)[0] || "client",
            service: request.serviceName || request.problemType,
            city: request.city,
            status: request.status,
            desiredStart: request.desiredStart,
            proposedStart: request.proposedStart,
            quoteStatus: request.quoteStatus,
          }),
        },
      ],
      signal: AbortSignal.timeout(12000),
    });
    const content = completion.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ...fallback, generatedBy: "fallback" as const };
    const parsed = draftSchema.safeParse(JSON.parse(content.trim()));
    if (!parsed.success) return { ...fallback, generatedBy: "fallback" as const };
    return { ...parsed.data, generatedBy: assistantModel };
  } catch {
    return { ...fallback, generatedBy: "fallback" as const };
  }
}

export const assistantRouter = router({
  overview: artisan.query(async ({ ctx }) => {
    const db = await dbRequired();
    await requireAdmin(db, ctx.user);
    const [requests, appointments, quoteDrafts, invoices, payments, messages, incidents, actions, scheduledActions] =
      await Promise.all([
        db
          .select({
            id: s.requests.id,
            reference: s.requests.reference,
            status: s.requests.status,
            name: s.requests.name,
            email: s.requests.email,
            phone: s.requests.phone,
            serviceName: s.requests.serviceName,
            problemType: s.requests.problemType,
            city: s.requests.city,
            desiredStart: s.requests.desiredStart,
            proposedStart: s.requests.proposedStart,
            quoteStatus: s.requests.quoteStatus,
            createdAt: s.requests.createdAt,
            assignedTo: s.artisanTeam.displayName,
            clientConfirmedAt: s.interventions.clientConfirmedAt,
          })
          .from(s.requests)
          .leftJoin(s.artisanAssignments, and(eq(s.artisanAssignments.requestId, s.requests.id), eq(s.artisanAssignments.status, "assigned")))
          .leftJoin(s.interventions, eq(s.interventions.requestId, s.requests.id))
          .leftJoin(s.artisanTeam, eq(s.artisanTeam.id, s.artisanAssignments.teamMemberId))
          .orderBy(desc(s.requests.id))
          .limit(100),
        db
          .select({
            id: s.appointments.id,
            requestId: s.appointments.requestId,
            startAt: s.appointments.startAt,
            endAt: s.appointments.endAt,
            status: s.appointments.status,
            reference: s.requests.reference,
            name: s.requests.name,
            city: s.requests.city,
          })
          .from(s.appointments)
          .innerJoin(s.requests, eq(s.requests.id, s.appointments.requestId))
          .orderBy(s.appointments.startAt)
          .limit(100),
        db
          .select({
            id: s.quoteDrafts.id,
            requestId: s.quoteDrafts.requestId,
            reference: s.quoteDrafts.reference,
            status: s.quoteDrafts.status,
            totalCents: s.quoteDrafts.totalCents,
            createdAt: s.quoteDrafts.createdAt,
          })
          .from(s.quoteDrafts)
          .where(inArray(s.quoteDrafts.status, ["draft", "generated"]))
          .orderBy(desc(s.quoteDrafts.id))
          .limit(50),
        db
          .select({
            id: s.invoices.id,
            requestId: s.invoices.requestId,
            amountCents: s.invoices.amountCents,
            issuedAt: s.invoices.issuedAt,
            paidAt: s.invoices.paidAt,
            reference: s.requests.reference,
            name: s.requests.name,
          })
          .from(s.invoices)
          .innerJoin(s.requests, eq(s.requests.id, s.invoices.requestId))
          .orderBy(desc(s.invoices.id))
          .limit(50),
        db
          .select({
            id: s.payments.id,
            requestId: s.payments.requestId,
            status: s.payments.status,
            amountCents: s.payments.amountCents,
            failureReason: s.payments.failureReason,
            reference: s.requests.reference,
            name: s.requests.name,
          })
          .from(s.payments)
          .innerJoin(s.requests, eq(s.requests.id, s.payments.requestId))
          .where(inArray(s.payments.status, ["failed", "cancelled", "expired"]))
          .orderBy(desc(s.payments.id))
          .limit(50),
        db
          .select({
            id: s.messageOutbox.id,
            requestId: s.messageOutbox.requestId,
            channel: s.messageOutbox.channel,
            status: s.messageOutbox.status,
            lastError: s.messageOutbox.lastError,
            createdAt: s.messageOutbox.createdAt,
          })
          .from(s.messageOutbox)
          .where(inArray(s.messageOutbox.status, ["failed", "uncertain"]))
          .orderBy(desc(s.messageOutbox.id))
          .limit(30),
        db
          .select({
            id: s.incidents.id,
            requestId: s.incidents.requestId,
            kind: s.incidents.kind,
            message: s.incidents.message,
            createdAt: s.incidents.createdAt,
            reference: s.requests.reference,
            name: s.requests.name,
          })
          .from(s.incidents)
          .innerJoin(s.requests, eq(s.requests.id, s.incidents.requestId))
          .where(eq(s.incidents.status, "open"))
          .orderBy(desc(s.incidents.id))
          .limit(30),
        db
          .select({
            id: s.assistantActions.id,
            requestId: s.assistantActions.requestId,
            actionType: s.assistantActions.actionType,
            channel: s.assistantActions.channel,
            subject: s.assistantActions.subject,
            status: s.assistantActions.status,
            scheduledFor: s.assistantActions.scheduledFor,
            lastError: s.assistantActions.lastError,
            createdAt: s.assistantActions.createdAt,
          })
          .from(s.assistantActions)
          .orderBy(desc(s.assistantActions.id))
          .limit(12),
        db
          .select({
            id: s.assistantActions.id,
            requestId: s.assistantActions.requestId,
            channel: s.assistantActions.channel,
            recipient: s.assistantActions.recipient,
            subject: s.assistantActions.subject,
            scheduledFor: s.assistantActions.scheduledFor,
            reference: s.requests.reference,
          })
          .from(s.assistantActions)
          .leftJoin(s.requests, eq(s.requests.id, s.assistantActions.requestId))
          .where(eq(s.assistantActions.status, "scheduled"))
          .orderBy(s.assistantActions.scheduledFor)
          .limit(20),
      ]);

    const tasks: AssistantTask[] = [];
    for (const request of requests) {
      if (["to_analyze", "awaiting_mds"].includes(request.status)) {
        tasks.push({
          id: `request-${request.id}`,
          kind: "request",
          priority: "urgent",
          title: "Répondre à une nouvelle demande",
          detail: `${request.serviceName || request.problemType} · ${request.city}${request.assignedTo ? ` · Affectée à ${request.assignedTo}` : " · Affectation à confirmer"}`,
          requestId: request.id,
          reference: request.reference,
          clientName: request.name,
          dueAt: request.createdAt,
          actionLabel: "Ouvrir le dossier",
          autoQuoteable: request.quoteStatus !== "accepted",
        });
      } else if (["needs_information", "proposed_slot", "awaiting_client"].includes(request.status)) {
        const autoConfirmable =
          ["proposed_slot", "awaiting_client"].includes(request.status) &&
          !!request.proposedStart &&
          request.quoteStatus !== "pending" &&
          request.quoteStatus !== "refused";
        tasks.push({
          id: `follow-up-${request.id}`,
          kind: "request",
          priority: autoConfirmable ? "today" : "follow_up",
          title: autoConfirmable ? "Confirmer le rendez-vous prêt" : "Suivre une réponse en attente",
          detail: `${request.serviceName || request.problemType} · ${request.name}${request.assignedTo ? ` · Affectée à ${request.assignedTo}` : " · Affectation à confirmer"}`,
          requestId: request.id,
          reference: request.reference,
          clientName: request.name,
          dueAt: request.proposedStart || request.desiredStart || request.createdAt,
          actionLabel: autoConfirmable ? "Confirmer le rendez-vous" : "Préparer une relance",
          autoConfirmable,
        });
      } else if (["in_progress", "en_route"].includes(request.status)) {
        tasks.push({
          id: `intervention-${request.id}`,
          kind: "request",
          priority: "today",
          title: "Poursuivre l’intervention sur place",
          detail: `${request.serviceName || request.problemType} · ${request.name}${request.assignedTo ? ` · Affectée à ${request.assignedTo}` : " · Affectation à confirmer"}`,
          requestId: request.id,
          reference: request.reference,
          clientName: request.name,
          dueAt: request.proposedStart || request.desiredStart,
          actionLabel: "Ouvrir l’intervention",
        });
      }
    }
    for (const request of requests) {
      if (request.status === "paid" && request.clientConfirmedAt) {
        tasks.push({
          id: `validate-${request.id}`,
          kind: "request",
          priority: "today",
          title: "Valider le dossier terminé",
          detail: `${request.serviceName || request.problemType} · ${request.name} · photos et confirmation client enregistrées`,
          requestId: request.id,
          reference: request.reference,
          clientName: request.name,
          dueAt: request.clientConfirmedAt,
          actionLabel: "Valider le dossier",
          autoValidateable: true,
        });
      }
    }
    for (const appointment of appointments) {
      if (appointment.status === "cancelled") continue;
      if (parisDay(appointment.startAt) !== parisDay(new Date())) continue;
      tasks.push({
        id: `appointment-${appointment.id}`,
        kind: "appointment",
        priority: "today",
        title: "Rendez-vous aujourd’hui",
        detail: `${appointment.city} · ${appointment.name}`,
        requestId: appointment.requestId,
        reference: appointment.reference,
        clientName: appointment.name,
        dueAt: appointment.startAt,
        actionLabel: "Voir le dossier",
      });
    }
    for (const quote of quoteDrafts) {
      tasks.push({
        id: `quote-${quote.id}`,
        kind: "quote",
        priority: "follow_up",
        title: "Vérifier un devis préparé",
        detail: `${quote.reference} · ${quote.totalCents / 100} €`,
        requestId: quote.requestId,
        reference: quote.reference,
        clientName: null,
        dueAt: quote.createdAt,
        actionLabel: "Ouvrir le devis",
      });
    }
    for (const invoice of invoices.filter(item => !item.paidAt)) {
      tasks.push({
        id: `invoice-${invoice.id}`,
        kind: "invoice",
        priority: "follow_up",
        title: "Contrôler une facture impayée",
        detail: `${invoice.reference} · ${invoice.amountCents ? `${invoice.amountCents / 100} €` : "montant à vérifier"}`,
        requestId: invoice.requestId,
        reference: invoice.reference,
        clientName: invoice.name,
        dueAt: invoice.issuedAt,
        actionLabel: "Ouvrir la facture",
      });
    }
    for (const payment of payments) {
      tasks.push({
        id: `payment-${payment.id}`,
        kind: "payment",
        priority: "urgent",
        title: "Vérifier un paiement en échec",
        detail: `${payment.reference} · ${paymentReason(payment.failureReason, payment.status)}`,
        requestId: payment.requestId,
        reference: payment.reference,
        clientName: payment.name,
        dueAt: null,
        actionLabel: "Voir le paiement",
      });
    }
    for (const message of messages) {
      tasks.push({
        id: `message-${message.id}`,
        kind: "message",
        priority: "urgent",
        title: "Vérifier une notification non aboutie",
        detail: `${message.channel.toUpperCase()} · ${message.lastError || message.status}`,
        requestId: message.requestId,
        reference: null,
        clientName: null,
        dueAt: message.createdAt,
        actionLabel: "Ouvrir le dossier",
      });
    }
    for (const incident of incidents) {
      tasks.push({
        id: `incident-${incident.id}`,
        kind: "incident",
        priority: "urgent",
        title: "Traiter un incident ouvert",
        detail: `${incident.reference} · ${incident.message.slice(0, 140)}`,
        requestId: incident.requestId,
        reference: incident.reference,
        clientName: incident.name,
        dueAt: incident.createdAt,
        actionLabel: "Ouvrir le dossier",
      });
    }
    const rank = { urgent: 0, today: 1, follow_up: 2 };
    tasks.sort((a, b) => rank[a.priority] - rank[b.priority] || (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
    return {
      tasks: tasks.slice(0, 20),
      counts: {
        urgent: tasks.filter(task => task.priority === "urgent").length,
        today: tasks.filter(task => task.priority === "today").length,
        followUp: tasks.filter(task => task.priority === "follow_up").length,
        draftActions: actions.filter(action => action.status === "proposed").length,
        scheduledFollowUps: scheduledActions.length,
        unpaidInvoices: invoices.filter(invoice => !invoice.paidAt).length,
      },
      recentActions: actions,
      scheduledActions,
      channels: providerReadiness(),
      voice: voiceProviderReadiness(),
      assistantModel,
      note: "Les actions terrain restent simples. Les appels réels restent désactivés tant que le fournisseur Voice n’est pas configuré.",
    };
  }),
  autoConfirm: artisan.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    await requireAdmin(await dbRequired(), ctx.user);
    const result = await autoConfirmRequest(input.requestId, ctx.user.id);
    return {
      success: true as const,
      ...result,
      note: `Rendez-vous ${result.reference} confirmé et ajouté au planning${result.assignedTo ? ` de ${result.assignedTo}` : " de l’artisan MDS"}.`,
    };
  }),
  autoValidate: artisan.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    await requireAdmin(db, ctx.user);
    return db.transaction(async tx => {
      const [request] = await tx.select().from(s.requests).where(eq(s.requests.id, input.requestId)).limit(1).for("update");
      if (!request) fail("Le dossier demandé est introuvable.", "NOT_FOUND");
      if (request.status === "closed") return { success: true as const, note: "Le dossier est déjà validé et clôturé." };
      if (request.status !== "paid") fail("Le dossier ne peut être validé qu’après paiement vérifié.", "CONFLICT");
      const [intervention] = await tx.select().from(s.interventions).where(eq(s.interventions.requestId, request.id)).limit(1);
      if (!intervention?.completedAt || !intervention.clientConfirmedAt) fail("La validation client et la fin d’intervention sont encore nécessaires.", "CONFLICT");
      const [afterPhoto] = await tx.select({ id: s.documents.id }).from(s.documents).where(and(eq(s.documents.requestId, request.id), eq(s.documents.kind, "photo"), eq(s.documents.photoStage, "after"))).limit(1);
      if (!afterPhoto) fail("La photo après travaux est obligatoire avant validation.", "CONFLICT");
      await tx.update(s.requests).set({ status: "closed", version: request.version + 1, lastAction: "assistant:autoValidate", lastActionVersion: request.version + 1 }).where(and(eq(s.requests.id, request.id), eq(s.requests.version, request.version)));
      await event(tx, request, "closed", "Dossier validé automatiquement après intervention terminée, preuve photo, confirmation client et paiement vérifié.", "system", ctx.user.id);
      await recordAudit(tx, ctx.user.id, "assistant.request.autoValidate", "request", request.id);
      return { success: true as const, note: `Le dossier ${request.reference} est validé et clôturé.` };
    });
  }),
  prepareQuote: artisan
    .input(z.object({ requestId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      const [request] = await db
        .select()
        .from(s.requests)
        .where(eq(s.requests.id, input.requestId))
        .limit(1);
      if (!request) fail("Le dossier demandé est introuvable.", "NOT_FOUND");
      const existing = await db
        .select()
        .from(s.quoteDrafts)
        .where(eq(s.quoteDrafts.requestId, request.id))
        .orderBy(desc(s.quoteDrafts.id))
        .limit(1);
      if (existing[0]) {
        return { created: false as const, draftId: existing[0].id, totalCents: existing[0].totalCents, note: "Le brouillon de devis existant a été retrouvé dans le dossier." };
      }
      const snapshot = request.pricingSnapshot as { totalCents?: number | null; included?: string; excluded?: string; conditions?: string } | null;
      const [catalogService] = await db
        .select({ priceCents: s.services.priceCents, pricingMode: s.services.pricingMode, name: s.services.name, trade: s.services.trade, durationMinutes: s.services.durationMinutes })
        .from(s.services)
        .where(and(
          request.serviceId ? eq(s.services.id, request.serviceId) : eq(s.services.name, request.serviceName || ""),
          eq(s.services.active, true),
          isNull(s.services.deletedAt),
        ))
        .limit(1);
      const catalogPrice = catalogService?.priceCents ?? null;
      const authoritativePrice = request.proposedPriceCents ?? snapshot?.totalCents ?? catalogPrice;
      const provisionalPrice = authoritativePrice == null
        ? provisionalQuoteCents(inferTrade(request), catalogService?.durationMinutes ?? request.durationMinutes)
        : null;
      const totalCents = authoritativePrice ?? provisionalPrice;
      if (!Number.isSafeInteger(totalCents) || totalCents === null || totalCents < 0) {
        fail("Le dossier ne contient pas assez d’informations pour préparer un montant. Ajoutez une prestation active ou un prix proposé.", "CONFLICT");
      }
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setDate(validUntil.getDate() + 30);
      const content = quoteContentSchema.parse({
        issuerName: "MULTISERVICES MDS",
        issuerAddress: "Adresse à compléter dans Paramètres MDS",
        issuerRegistration: "Informations légales à compléter dans Paramètres MDS",
        issuerEmail: request.email,
        issuerPhone: request.phone,
        clientName: request.name,
        clientAddress: `${request.address}, ${request.postcode} ${request.city}`,
        title: `Devis — ${request.serviceName || request.problemType || "prestation MDS"}`,
        validUntil: validUntil.toISOString().slice(0, 10),
        lines: [{ label: request.serviceName || request.problemType || "Prestation MDS", quantity: 1, unitCents: totalCents, vatBasisPoints: 2000 }],
        included: snapshot?.included || "Périmètre décrit dans la demande client.",
        excluded: snapshot?.excluded || "Travaux supplémentaires non décrits dans la demande.",
        conditions: snapshot?.conditions || (provisionalPrice != null
          ? `Estimation provisoire préparée automatiquement selon le métier détecté (${inferTrade(request)}) et la durée prévue. L’artisan doit vérifier le périmètre et le montant avant tout envoi au client. Aucun paiement ne peut être demandé sur cette estimation seule.`
          : catalogService?.pricingMode === "fixed"
          ? "Montant calculé à partir du tarif catalogue actif de la prestation. Toute modification du périmètre fera l’objet d’un nouveau devis."
          : "Montant préparé à partir du tarif catalogue actif. Vérifier le périmètre sur place avant validation du devis."),
        paymentTerms: "Paiement selon les conditions validées par le client et MDS.",
        depositCents: 0,
        taxNote: "TVA incluse selon le taux applicable.",
        insuranceNote: "Informations d’assurance à compléter dans Paramètres MDS.",
      });
      const totals = quoteTotals(content.lines);
      const [created] = await db.insert(s.quoteDrafts).values({
        requestId: request.id,
        content,
        totalCents: totals.totalCents,
        version: 0,
        status: "draft",
        reference: `MDS-D-${now.toISOString().slice(0, 10)}-${Date.now()}`,
      }).returning({ id: s.quoteDrafts.id });
      await recordAudit(db, ctx.user.id, "assistant.quoteDraft.prepare", "quoteDraft", created.id);
      return { created: true as const, draftId: created.id, totalCents: totals.totalCents, note: `${provisionalPrice != null ? "Une estimation provisoire" : "Le brouillon de devis"} de ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totals.totalCents / 100)} a été préparée. Vérifiez le montant avant génération et envoi.` };
    }),
  draft: artisan.input(draftInput).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    const [request] = await db.select().from(s.requests).where(eq(s.requests.id, input.requestId)).limit(1);
    if (!request) fail("Le dossier demandé est introuvable.", "NOT_FOUND");
    const recipient = input.channel === "email" ? request.email : input.channel === "sms" ? request.phone : request.phone;
    if (!recipient) fail("Le dossier ne contient pas de coordonnée pour cette action.", "BAD_REQUEST");
    const draft = await createDraftWithAi(request, input.actionType, input.channel);
    const dedupeKey = `assistant:${ctx.user.id}:${request.id}:${input.actionType}:${input.channel}:${Date.now()}`;
    const [created] = await db.insert(s.assistantActions).values({
      requestId: request.id,
      createdBy: ctx.user.id,
      actionType: input.actionType,
      channel: input.channel,
      recipient,
      subject: draft.subject,
      body: draft.body,
      status: "proposed",
      dedupeKey,
    }).returning({ id: s.assistantActions.id });
    await recordAudit(db, ctx.user.id, "assistant.draft", "assistant_action", created.id);
    return {
      id: created.id,
      ...draft,
      actionType: input.actionType,
      channel: input.channel,
      recipient,
      status: "proposed" as const,
      note: draft.generatedBy === "fallback" ? "Brouillon de secours utilisé : l’IA était indisponible. Relisez-le avant toute action." : "Brouillon IA créé. Rien ne sera envoyé sans votre validation.",
    };
  }),
  approve: artisan.input(z.object({
    actionId: z.number().int().positive(),
    // Texte relu à l’écran : s’il a été retouché, c’est lui qui est envoyé.
    subject: draftSchema.shape.subject.optional(),
    body: draftSchema.shape.body.optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    const [action] = await db.select().from(s.assistantActions).where(eq(s.assistantActions.id, input.actionId)).limit(1);
    if (!action) fail("Cette proposition n’existe plus.", "NOT_FOUND");
    if (action.status !== "proposed") fail("Cette proposition a déjà été traitée.", "CONFLICT");
    if ((input.subject && input.subject !== action.subject) || (input.body && input.body !== action.body)) {
      const subject = input.subject ?? action.subject;
      const body = input.body ?? action.body;
      const edited = await db.update(s.assistantActions).set({ subject, body }).where(and(eq(s.assistantActions.id, action.id), eq(s.assistantActions.status, "proposed"))).returning({ id: s.assistantActions.id });
      if (edited.length !== 1) fail("Cette proposition a déjà été traitée.", "CONFLICT");
      action.subject = subject;
      action.body = body;
    }
    const channel = action.channel;
    if (channel === "call") {
      try {
        const call = await createOutboundVoiceCall({
          to: action.recipient,
          requestId: action.requestId ?? undefined,
        });
        await db.update(s.assistantActions).set({
          status: "sent",
          approvedAt: new Date(),
          completedAt: new Date(),
          lastError: null,
        }).where(eq(s.assistantActions.id, action.id));
        await recordAudit(db, ctx.user.id, "assistant.voiceCall.started", "assistant_action", action.id);
        return { status: "sent" as const, note: `Appel lancé${call.sid ? ` (${call.sid})` : ""}.` };
      } catch (error) {
        const note = error instanceof Error ? error.message : "L’appel n’a pas pu être lancé.";
        await db.update(s.assistantActions).set({ status: "failed", approvedAt: new Date(), completedAt: new Date(), lastError: note }).where(eq(s.assistantActions.id, action.id));
        return { status: "failed" as const, note };
      }
    }
    const p = await principal(db);
    const ready = providerReadiness();
    const enabled = channel === "email" ? p.emailEnabled && ready.email && !!p.emailFrom : p.smsEnabled && ready.sms && !!p.smsFrom;
    await db.transaction(async tx => {
      await tx.insert(s.messageOutbox).values({
        dedupeKey: `assistant-action:${action.id}`,
        requestId: action.requestId,
        userId: null,
        organizationId: null,
        channel,
        recipient: action.recipient,
        subject: action.subject,
        body: action.body,
        status: enabled ? "queued" : "disabled",
        lastError: enabled ? null : "Canal externe non configuré ou désactivé dans MDS.",
      });
      await tx.update(s.assistantActions).set({
        status: enabled ? "approved" : "failed",
        approvedAt: new Date(),
        completedAt: enabled ? null : new Date(),
        lastError: enabled ? null : "Canal externe non configuré ou désactivé dans MDS.",
      }).where(eq(s.assistantActions.id, action.id));
      await recordAudit(tx, ctx.user.id, "assistant.approve", "assistant_action", action.id);
    });
    if (!enabled) return { status: "failed" as const, note: "Le brouillon est conservé, mais aucun message n’a été envoyé : configurez d’abord le canal dans Paramètres MDS." };
    const result = await processOutbox(db, p, 1);
    const [outbox] = await db.select({ status: s.messageOutbox.status, lastError: s.messageOutbox.lastError }).from(s.messageOutbox).where(eq(s.messageOutbox.dedupeKey, `assistant-action:${action.id}`)).limit(1);
    if (outbox?.status === "accepted" || outbox?.status === "delivered") {
      await db.update(s.assistantActions).set({ status: "sent", completedAt: new Date(), lastError: null }).where(eq(s.assistantActions.id, action.id));
      return { status: "sent" as const, note: "Le message a été accepté par le fournisseur configuré." };
    }
    return { status: "approved" as const, note: outbox?.lastError || (result.messagesFailed ? "Le fournisseur a refusé le message. Le dossier reste visible pour reprise." : "Le message est en attente de traitement.") };
  }),
  cancel: artisan.input(z.object({ actionId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    const [action] = await db.select({ id: s.assistantActions.id, status: s.assistantActions.status }).from(s.assistantActions).where(eq(s.assistantActions.id, input.actionId)).limit(1);
    if (!action) fail("Cette proposition n’existe plus.", "NOT_FOUND");
    if (action.status !== "proposed") fail("Cette proposition a déjà été traitée.", "CONFLICT");
    await db.update(s.assistantActions).set({ status: "cancelled", completedAt: new Date() }).where(eq(s.assistantActions.id, input.actionId));
    await recordAudit(db, ctx.user.id, "assistant.cancel", "assistant_action", input.actionId);
    return { success: true as const };
  }),
  // Programmer une relance déjà relue : elle partira à l’heure choisie, sans
  // nouvelle intervention, et seulement si le dossier est toujours actif.
  schedule: artisan
    .input(
      z.object({
        actionId: z.number().int().positive(),
        when: z.enum(followUpPresets),
        subject: draftSchema.shape.subject.optional(),
        body: draftSchema.shape.body.optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      await requireAdmin(db, ctx.user);
      const result = await scheduleFollowUp(db, {
        actionId: input.actionId,
        sendAt: followUpDate(input.when),
        actorId: ctx.user.id,
        subject: input.subject,
        body: input.body,
      });
      const when = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(result.scheduledFor);
      return {
        ...result,
        note: `Relance programmée pour ${when}. Rien n’est envoyé avant, et vous pouvez l’annuler jusque-là.`,
      };
    }),
  unschedule: artisan
    .input(z.object({ actionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      await requireAdmin(db, ctx.user);
      await unscheduleFollowUp(db, { actionId: input.actionId, actorId: ctx.user.id });
      return { status: "cancelled" as const, note: "La relance programmée est annulée. Rien n’a été envoyé." };
    }),
});
