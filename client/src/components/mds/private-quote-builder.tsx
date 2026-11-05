import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  quoteContentSchema,
  quoteTotals,
  type QuoteContent,
} from "@shared/operations";
import { money } from "@shared/mds";
import type { MdsOutputs, RequestRecord } from "./private-types";
import {
  ActionButton,
  DocumentList,
  ErrorNotice,
  Field,
  PrivateModal,
  QueryState,
} from "./private-common";
import { euroInput, parseEuroCents } from "./private-pricing";

type Draft = MdsOutputs["quoteBuilder"]["list"][number];
export function PrivateQuoteBuilder({
  request,
  latestQuoteDocumentId,
  onChanged,
  onSubmitQuote,
}: {
  request: RequestRecord;
  latestQuoteDocumentId?: number;
  onChanged: () => Promise<unknown>;
  onSubmitQuote: (amount: number) => void;
}) {
  const list = trpc.mds.quoteBuilder.list.useQuery(
    { requestId: request.id },
    { retry: false }
  );
  const save = trpc.mds.quoteBuilder.save.useMutation();
  const generate = trpc.mds.quoteBuilder.generate.useMutation();
  const [editor, setEditor] = useState<{ draft?: Draft; copy: boolean } | null>(
    null
  );
  const [error, setError] = useState<unknown>(null);
  const pending = save.isPending || generate.isPending;
  async function refresh() {
    await Promise.all([list.refetch(), onChanged()]);
  }
  async function generatePdf(draft: Draft) {
    setError(null);
    try {
      await generate.mutateAsync({ id: draft.id, version: draft.version });
      await refresh();
    } catch (cause) {
      setError(cause);
      await refresh();
    }
  }
  return (
    <details className="stack">
      <summary
        style={{
          minHeight: 44,
          padding: "12px 0",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Préparer un devis
      </summary>
      <ActionButton
        disabled={pending}
        onClick={() => {
          setError(null);
          setEditor({ copy: false });
        }}
      >
        Nouveau devis
      </ActionButton>
      <QueryState
        loading={list.isLoading}
        error={list.error}
        retry={list.refetch}
      />
      <ErrorNotice error={error} />
      {list.data?.map(draft => (
        <article className="notice stack" key={draft.id}>
          <strong>
            {draft.content.title} · {money(draft.totalCents)}
          </strong>
          <small className="muted">
            {draft.reference} ·{" "}
            {draft.status === "draft"
              ? "Brouillon"
              : draft.status === "generated"
                ? "PDF prêt, non soumis"
                : "Soumis au client"}
          </small>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {draft.status === "draft" && (
              <>
                <ActionButton
                  disabled={pending}
                  onClick={() => setEditor({ draft, copy: false })}
                >
                  Modifier
                </ActionButton>
                <ActionButton
                  disabled={pending}
                  onClick={() => void generatePdf(draft)}
                >
                  Générer le PDF
                </ActionButton>
              </>
            )}
            {draft.status !== "draft" && (
              <ActionButton
                disabled={pending}
                onClick={() => setEditor({ draft, copy: true })}
              >
                Créer une nouvelle version
              </ActionButton>
            )}
            {draft.status === "generated" &&
              draft.documentId === latestQuoteDocumentId && (
                <ActionButton
                  disabled={pending}
                  onClick={() => onSubmitQuote(draft.totalCents)}
                >
                  Soumettre ce devis
                </ActionButton>
              )}
          </div>
          {draft.documentId && (
            <DocumentList
              reference={request.reference}
              documents={[
                {
                  id: draft.documentId,
                  name: `${draft.reference}.pdf`,
                  mimeType: "application/pdf",
                  kind: "quote",
                  photoStage: "other",
                  photoAuthor: "other",
                  description: null,
                  createdAt: draft.createdAt,
                },
              ]}
            />
          )}
        </article>
      ))}
      {editor && (
        <QuoteEditor
          key={`${editor.draft?.id || "new"}-${editor.copy}`}
          request={request}
          draft={editor.draft}
          pending={pending}
          error={error}
          onClose={() => setEditor(null)}
          onSave={async content => {
            setError(null);
            try {
              await save.mutateAsync({
                requestId: request.id,
                requestVersion: request.version,
                ...(editor.draft && !editor.copy
                  ? { id: editor.draft.id, version: editor.draft.version }
                  : {}),
                content,
              });
              setEditor(null);
              await refresh();
            } catch (cause) {
              setError(cause);
              await refresh();
            }
          }}
        />
      )}
    </details>
  );
}
type TextKey = Exclude<keyof QuoteContent, "lines" | "depositCents">;
type EditableLine = {
  label: string;
  quantity: string;
  unit: string;
  vat: string;
};
function QuoteEditor({
  request,
  draft,
  pending,
  error,
  onClose,
  onSave,
}: {
  request: RequestRecord;
  draft?: Draft;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (content: QuoteContent) => Promise<unknown>;
}) {
  const initial = draft?.content;
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<TextKey, string>>({
    issuerName: initial?.issuerName || "",
    issuerAddress: initial?.issuerAddress || "",
    issuerRegistration: initial?.issuerRegistration || "",
    issuerEmail: initial?.issuerEmail || "",
    issuerPhone: initial?.issuerPhone || "",
    clientName: initial?.clientName || request.name,
    clientAddress:
      initial?.clientAddress ||
      `${request.address}, ${request.postcode} ${request.city}`,
    title: initial?.title || request.serviceName || "",
    validUntil: initial?.validUntil || "",
    included: initial?.included || "",
    excluded: initial?.excluded || "",
    conditions: initial?.conditions || "",
    paymentTerms: initial?.paymentTerms || "",
    taxNote: initial?.taxNote || "",
    insuranceNote: initial?.insuranceNote || "",
  });
  const [deposit, setDeposit] = useState(
    initial ? euroInput(initial.depositCents) : ""
  );
  const [lines, setLines] = useState<EditableLine[]>(
    initial?.lines.map(line => ({
      label: line.label,
      quantity: String(line.quantity),
      unit: euroInput(line.unitCents),
      vat: euroInput(line.vatBasisPoints),
    })) || [{ label: "", quantity: "1", unit: "", vat: "" }]
  );
  const [localError, setLocalError] = useState<unknown>(null);
  function field(key: TextKey, label: string, long = false, type = "text") {
    return (
      <Field key={key} label={label}>
        {long ? (
          <textarea
            required
            rows={3}
            maxLength={key === "conditions" ? 5000 : 2000}
            value={values[key]}
            onChange={e => setValues({ ...values, [key]: e.target.value })}
          />
        ) : (
          <input
            required
            type={type}
            maxLength={key.includes("Address") ? 500 : 320}
            value={values[key]}
            onChange={e => setValues({ ...values, [key]: e.target.value })}
          />
        )}
      </Field>
    );
  }
  function parsedLines() {
    return lines.map(line => {
      const unitCents = parseEuroCents(line.unit, "Prix unitaire HT");
      const vatBasisPoints = parseEuroCents(line.vat, "Taux de TVA");
      if (unitCents == null || vatBasisPoints == null)
        throw new Error(
          "Saisissez le prix et le taux de TVA, y compris 0 si applicable."
        );
      return {
        label: line.label,
        quantity: Number(line.quantity),
        unitCents,
        vatBasisPoints,
      };
    });
  }
  let total: number | null = null;
  try {
    total = quoteTotals(parsedLines()).totalCents;
  } catch {
    /* Incomplete form, no invented total. */
  }
  async function submit() {
    setLocalError(null);
    try {
      const depositCents = parseEuroCents(deposit, "Acompte");
      if (depositCents == null)
        throw new Error("Précisez l’acompte, y compris 0.");
      const content = quoteContentSchema.parse({
        ...values,
        depositCents,
        lines: parsedLines(),
      });
      if (depositCents > quoteTotals(content.lines).totalCents)
        throw new Error("L’acompte dépasse le total.");
      await onSave(content);
    } catch (cause) {
      setLocalError(cause);
    }
  }
  return (
    <PrivateModal
      title="Préparer le devis"
      description={`${step + 1}/3 · ${["Identités", "Travaux et prix", "Conditions"][step]}`}
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          if (step < 2) setStep(step + 1);
          else void submit();
        }}
      >
        {step === 0 && (
          <>
            <h3>Émetteur</h3>
            {field("issuerName", "Nom / raison sociale")}
            {field("issuerAddress", "Adresse de l’émetteur")}
            {field("issuerRegistration", "Immatriculation réelle")}
            {field("issuerEmail", "Email", false, "email")}
            {field("issuerPhone", "Téléphone", false, "tel")}
            <h3>Client et lieu</h3>
            {field("clientName", "Nom du client")}
            {field("clientAddress", "Adresse des travaux")}
          </>
        )}
        {step === 1 && (
          <>
            {field("title", "Objet du devis")}
            {lines.map((line, index) => (
              <div key={index} className="notice stack">
                <Field label={`Travail ${index + 1}`}>
                  <input
                    required
                    minLength={2}
                    maxLength={300}
                    value={line.label}
                    onChange={e =>
                      setLines(
                        lines.map((row, n) =>
                          n === index ? { ...row, label: e.target.value } : row
                        )
                      )
                    }
                  />
                </Field>
                <div className="form-grid">
                  {(
                    [
                      ["quantity", "Quantité"],
                      ["unit", "Prix unitaire HT (€)"],
                      ["vat", "TVA (%)"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        required
                        inputMode="decimal"
                        type={key === "quantity" ? "number" : "text"}
                        min={key === "quantity" ? 1 : undefined}
                        max={key === "quantity" ? 10000 : undefined}
                        step={key === "quantity" ? 1 : undefined}
                        value={line[key]}
                        onChange={e =>
                          setLines(
                            lines.map((row, n) =>
                              n === index
                                ? { ...row, [key]: e.target.value }
                                : row
                            )
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>
                {lines.length > 1 && (
                  <ActionButton
                    onClick={() =>
                      setLines(lines.filter((_, n) => n !== index))
                    }
                  >
                    Retirer cette ligne
                  </ActionButton>
                )}
              </div>
            ))}
            <ActionButton
              disabled={lines.length >= 40}
              onClick={() =>
                setLines([
                  ...lines,
                  { label: "", quantity: "1", unit: "", vat: "" },
                ])
              }
            >
              Ajouter un travail
            </ActionButton>
            <strong>
              Total TTC : {total === null ? "à compléter" : money(total)}
            </strong>
          </>
        )}
        {step === 2 && (
          <>
            {field("validUntil", "Valable jusqu’au", false, "date")}
            {field("included", "Compris", true)}
            {field("excluded", "Non compris", true)}
            {field("conditions", "Conditions d’intervention", true)}
            {field("paymentTerms", "Modalités de paiement", true)}
            <Field label="Acompte indiqué (€)">
              <input
                required
                inputMode="decimal"
                value={deposit}
                onChange={e => setDeposit(e.target.value)}
              />
            </Field>
            {field("taxNote", "Mention fiscale applicable", true)}
            {field(
              "insuranceNote",
              "Assurance réelle et couverture déclarée",
              true
            )}
            <p className="muted">
              Aucune mention fiscale ou assurance n’est inventée. L’acompte
              indiqué ne crée pas automatiquement de paiement.
            </p>
          </>
        )}
        <ErrorNotice error={localError ?? error} />
        <div className="row">
          {step > 0 && (
            <ActionButton disabled={pending} onClick={() => setStep(step - 1)}>
              Retour
            </ActionButton>
          )}
          <ActionButton type="submit" className="primary" disabled={pending}>
            {pending
              ? "Enregistrement…"
              : step < 2
                ? "Continuer"
                : "Enregistrer le brouillon"}
          </ActionButton>
        </div>
      </form>
    </PrivateModal>
  );
}
