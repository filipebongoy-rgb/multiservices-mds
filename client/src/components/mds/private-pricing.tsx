import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { money } from "@shared/mds";
import {
  calculatePricing,
  MAX_CENTS,
  travelRuleSchema,
  validatePricingRules,
  type PricingRules,
  type PricingSnapshot,
} from "@shared/pricing";
import { ActionButton, ErrorNotice, Field } from "./private-common";

/** Parse decimal text without floating-point rounding. Empty means unconfigured. */
export function parseEuroCents(
  input: string,
  label = "Montant"
): number | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(value))
    throw new Error(
      `${label} : saisissez un montant positif en euros, avec au maximum deux décimales (virgule ou point).`
    );
  const [euros, decimals = ""] = value.split(/[.,]/);
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS)
    throw new Error(`${label} : le montant dépasse la limite autorisée.`);
  return cents;
}

export function euroInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

export type PricingDraft = {
  price: string;
  travelFee: string;
  rules: { prefix: string; fee: string }[];
};

export function initialPricingDraft(
  rules?: Partial<PricingRules>
): PricingDraft {
  return {
    price: euroInput(rules?.priceCents),
    travelFee: euroInput(rules?.travelFeeCents),
    rules: (rules?.travelRules ?? []).map(rule => ({
      prefix: rule.prefix,
      fee: euroInput(rule.feeCents),
    })),
  };
}

export function parsePricingDraft(draft: PricingDraft) {
  return {
    priceCents: parseEuroCents(draft.price, "Prix de la prestation"),
    travelFeeCents: parseEuroCents(draft.travelFee, "Déplacement fixe"),
    travelRules: draft.rules.map((rule, index) => {
      const feeCents = parseEuroCents(
        rule.fee,
        `Déplacement, règle ${index + 1}`
      );
      if (feeCents === null)
        throw new Error(
          `Règle ${index + 1} : renseignez des frais, y compris zéro s’ils sont nuls.`
        );
      const parsed = travelRuleSchema.safeParse({
        prefix: rule.prefix.trim(),
        feeCents,
      });
      if (!parsed.success)
        throw new Error(
          `Règle ${index + 1} : ${parsed.error.issues[0].message}`
        );
      return parsed.data;
    }),
  };
}

export function PricingEditor({
  values,
  draft,
  onChange,
  onDraftChange,
  serviceId,
  serviceName,
  revision,
}: {
  values: PricingRules;
  draft: PricingDraft;
  onChange: (changes: Partial<PricingRules>) => void;
  onDraftChange: (draft: PricingDraft) => void;
  serviceId?: number;
  serviceName: string;
  revision?: number;
}) {
  const [postcode, setPostcode] = useState("");
  const updateRule = (
    index: number,
    change: Partial<PricingDraft["rules"][number]>
  ) =>
    onDraftChange({
      ...draft,
      rules: draft.rules.map((rule, i) =>
        i === index ? { ...rule, ...change } : rule
      ),
    });
  let preview = null;
  let previewError: unknown = null;
  try {
    const rules = { ...values, ...parsePricingDraft(draft) };
    const issue = validatePricingRules(rules);
    if (issue) throw new Error(issue);
    preview = calculatePricing(
      {
        ...rules,
        id: serviceId ?? 0,
        name: serviceName,
        pricingVersion: revision ?? 0,
      },
      postcode
    );
  } catch (cause) {
    previewError = cause;
  }
  return (
    <section className="stack" aria-label="Tarification hybride">
      <Field label="Mode tarifaire">
        <select
          value={values.pricingMode}
          onChange={e =>
            onChange({
              pricingMode: e.target.value === "fixed" ? "fixed" : "quote",
            })
          }
        >
          <option value="fixed">Mode A — Prix affiché</option>
          <option value="quote">Mode B — Devis personnalisé</option>
        </select>
      </Field>
      <p className="notice">
        {values.pricingMode === "fixed"
          ? "Pour une prestation standardisée : le client envoie sa demande au prix de base et aux frais de déplacement configurés. Toute modification du montant ou du périmètre passe par un nouveau devis accepté."
          : "Pour un besoin nécessitant une analyse : MDS prépare un vrai devis PDF, que le client accepte séparément. Aucun prix ferme n’est annoncé."}
      </p>
      {values.pricingMode === "fixed" ? (
        <Field
          label="Prix de base de la prestation (€)"
          hint="Obligatoire en mode A. Virgule ou point, deux décimales maximum ; aucun montant n’est prérempli."
        >
          <input
            type="text"
            inputMode="decimal"
            required
            maxLength={20}
            value={draft.price}
            onChange={e => onDraftChange({ ...draft, price: e.target.value })}
          />
        </Field>
      ) : draft.price ? (
        <p className="muted">
          Le prix de base précédemment saisi est conservé dans la configuration.
          Il n’est ni affiché au public ni utilisé pour ce mode.
        </p>
      ) : null}
      <Field label="Règle tarifaire ou préparation du devis">
        <textarea
          rows={2}
          maxLength={500}
          value={values.pricingRule}
          onChange={e => onChange({ pricingRule: e.target.value })}
        />
      </Field>
      <div className="form-grid">
        <Field
          label="Ce qui est inclus"
          hint="Décrivez le périmètre réel de la prestation."
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={values.included}
            onChange={e => onChange({ included: e.target.value })}
          />
        </Field>
        <Field
          label="Ce qui n’est pas inclus"
          hint="Précisez les exclusions, ou indiquez explicitement qu’il n’y en a pas."
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={values.excluded}
            onChange={e => onChange({ excluded: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Frais de déplacement"
        hint="Sans validation explicite, les frais restent non configurés ; aucun supplément n’est inventé."
      >
        <select
          value={values.travelMode}
          onChange={e => {
            const mode = e.target.value;
            if (
              mode === "unconfigured" ||
              mode === "included" ||
              mode === "fixed" ||
              mode === "postcode"
            )
              onChange({ travelMode: mode });
          }}
        >
          <option value="unconfigured">Non configurés — à valider</option>
          <option value="included">Inclus dans la prestation</option>
          <option value="fixed">Frais fixes</option>
          <option value="postcode">Selon le préfixe du code postal</option>
        </select>
      </Field>
      {values.travelMode === "fixed" && (
        <Field
          label="Frais de déplacement fixes (€)"
          hint="Saisissez explicitement zéro si les frais sont nuls."
        >
          <input
            type="text"
            inputMode="decimal"
            required
            maxLength={20}
            value={draft.travelFee}
            onChange={e =>
              onDraftChange({ ...draft, travelFee: e.target.value })
            }
          />
        </Field>
      )}
      {values.travelMode === "postcode" && (
        <section
          className="stack"
          aria-label="Règles de déplacement par code postal"
        >
          <p className="muted">
            Préfixes de 1 à 5 chiffres, sans doublon. La règle la plus précise
            s’applique. Un code postal non couvert nécessite un devis.
          </p>
          {draft.rules.map((rule, index) => (
            <div
              key={index}
              className="stack"
              style={{ borderBottom: "1px solid #e7e5e2", paddingBottom: 12 }}
            >
              <div className="form-grid">
                <Field label={`Règle ${index + 1} — Préfixe postal`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{1,5}"
                    maxLength={5}
                    required
                    value={rule.prefix}
                    onChange={e =>
                      updateRule(index, { prefix: e.target.value })
                    }
                  />
                </Field>
                <Field label={`Règle ${index + 1} — Frais (€)`}>
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={20}
                    required
                    value={rule.fee}
                    onChange={e => updateRule(index, { fee: e.target.value })}
                  />
                </Field>
              </div>
              <ActionButton
                aria-label={`Supprimer la règle de déplacement ${index + 1}`}
                onClick={() =>
                  onDraftChange({
                    ...draft,
                    rules: draft.rules.filter((_, i) => i !== index),
                  })
                }
                style={{ alignSelf: "start" }}
              >
                <Trash2 size={16} aria-hidden="true" /> Supprimer cette règle
              </ActionButton>
            </div>
          ))}
          <ActionButton
            disabled={draft.rules.length >= 100}
            onClick={() =>
              onDraftChange({
                ...draft,
                rules: [...draft.rules, { prefix: "", fee: "" }],
              })
            }
            style={{ alignSelf: "start" }}
          >
            <Plus size={16} aria-hidden="true" /> Ajouter une règle
          </ActionButton>
        </section>
      )}
      <section
        className="notice stack"
        aria-label="Aperçu de configuration tarifaire"
      >
        <h4>Aperçu de configuration — pas une offre réelle</h4>
        <p className="muted">
          Calcul privé depuis les champs saisis. Enregistrer et valider la
          prestation reste nécessaire ; les anciens dossiers ne sont pas
          modifiés.
        </p>
        {values.pricingMode === "fixed" && values.travelMode === "postcode" && (
          <Field
            label="Code postal pour l’aperçu"
            hint="Saisissez votre propre code postal de vérification, sans créer de demande."
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={postcode}
              onChange={e => setPostcode(e.target.value)}
            />
          </Field>
        )}
        <ErrorNotice error={previewError} />
        {preview && (
          <div role="status" aria-live="polite">
            {preview.pricingMode === "fixed" && (
              <p>
                Base : {money(preview.baseCents)} · Déplacement :{" "}
                {preview.travelCents == null
                  ? "Non déterminé"
                  : money(preview.travelCents)}
              </p>
            )}
            <p>
              <strong>
                {preview.requiresQuote
                  ? "Devis nécessaire"
                  : `Total calculé : ${money(preview.totalCents)}`}
              </strong>
            </p>
            <p>{preview.reason}</p>
          </div>
        )}
      </section>
    </section>
  );
}

export function PricingSnapshotSummary({
  snapshot,
}: {
  snapshot: PricingSnapshot;
}) {
  return (
    <section
      className="notice stack"
      aria-label="Conditions tarifaires conservées au dépôt"
    >
      <h4>Tarif et périmètre d’origine — conservés au dépôt</h4>
      <p className="muted">
        Ces conditions restent inchangées même si le catalogue est modifié. Un
        devis ultérieur est une proposition distincte, visible dans le dossier.
      </p>
      <p>
        <strong>
          {snapshot.pricingMode === "fixed"
            ? "Mode A — Prix affiché"
            : "Mode B — Devis personnalisé"}
        </strong>{" "}
        · Révision {snapshot.revision}
      </p>
      <dl className="stack" style={{ overflowWrap: "anywhere" }}>
        <div>
          <dt>Prestation et lieu tarifaire</dt>
          <dd>
            {snapshot.serviceName || "Demande libre"} ·{" "}
            {snapshot.postcode || "Code postal non conservé"}
          </dd>
        </div>
        <div>
          <dt>Prix de base</dt>
          <dd>
            {snapshot.baseCents == null
              ? "Non déterminé au dépôt"
              : money(snapshot.baseCents)}
          </dd>
        </div>
        <div>
          <dt>Déplacement</dt>
          <dd>
            {snapshot.travelCents == null
              ? "Non déterminé au dépôt"
              : money(snapshot.travelCents)}{" "}
            ·{" "}
            {
              {
                unconfigured: "Non configuré",
                included: "Inclus",
                fixed: "Frais fixes",
                postcode: "Règle par préfixe postal",
              }[snapshot.travelMode]
            }
          </dd>
        </div>
        <div>
          <dt>Total annoncé au dépôt</dt>
          <dd>
            <strong>
              {snapshot.totalCents == null
                ? "Sur devis — aucun total ferme"
                : money(snapshot.totalCents)}
            </strong>
          </dd>
        </div>
        <div>
          <dt>Inclus</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {snapshot.included || "Non renseigné au dépôt"}
          </dd>
        </div>
        <div>
          <dt>Non inclus</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {snapshot.excluded || "Non renseigné au dépôt"}
          </dd>
        </div>
        <div>
          <dt>Conditions</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {snapshot.conditions || "Non renseignées au dépôt"}
          </dd>
        </div>
        <div>
          <dt>Durée indicative et zone</dt>
          <dd>
            {snapshot.durationMinutes} min ·{" "}
            {snapshot.zone || "Zone non renseignée au dépôt"}
          </dd>
        </div>
        {snapshot.pricingRule && (
          <div>
            <dt>Règle tarifaire ou de devis</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{snapshot.pricingRule}</dd>
          </div>
        )}
      </dl>
      <p>{snapshot.reason}</p>
    </section>
  );
}
