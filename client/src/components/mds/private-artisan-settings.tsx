import { useState } from "react";
import { CheckCircle2, Edit3, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { dateTime, money, serviceSchema, trades } from "@shared/mds";
import type { z } from "zod";
import {
  ActionButton,
  ErrorNotice,
  Field,
  PrivateModal,
  QueryState,
} from "./private-common";
import type { Service } from "./private-types";
import {
  initialPricingDraft,
  parsePricingDraft,
  PricingEditor,
} from "./private-pricing";

type Settings = {
  zone: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  legalName: string;
  legalNotice: string;
  proposalExpiryHours: number;
};

export function ArtisanSettings({
  services,
  catalogLoading,
  catalogError,
  retryCatalog,
  onCatalogChanged,
}: {
  services: Service[];
  catalogLoading: boolean;
  catalogError: unknown;
  retryCatalog: () => unknown;
  onCatalogChanged: () => void;
}) {
  const settings = trpc.mds.settings.get.useQuery(undefined, { retry: false });
  const [section, setSection] = useState<"business" | "catalog" | "audit">(
    "business"
  );
  return (
    <div className="stack">
      <div className="section-heading">
        <h2>Paramètres</h2>
        <p className="muted">
          Configurez vos informations réelles. Seules les prestations validées
          sont proposées au public.
        </p>
      </div>
      <div
        className="tabs row"
        style={{ flexWrap: "wrap" }}
        aria-label="Sections des paramètres"
      >
        {(
          [
            ["business", "Entreprise et propositions"],
            ["catalog", "Catalogue des prestations"],
            ["audit", "Journal sensible"],
          ] as const
        ).map(([key, label]) => (
          <ActionButton
            key={key}
            className={section === key ? "dark" : "secondary"}
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {label}
          </ActionButton>
        ))}
      </div>
      {section === "business" && (
        <section className="panel stack">
          <QueryState
            loading={settings.isLoading}
            error={settings.error}
            retry={settings.refetch}
          />
          {settings.data && (
            <SettingsForm
              initial={settings.data}
              onSaved={() => void settings.refetch()}
            />
          )}
        </section>
      )}
      {section === "catalog" && (
        <CatalogEditor
          services={services}
          loading={catalogLoading}
          error={catalogError}
          retry={retryCatalog}
          onChanged={onCatalogChanged}
        />
      )}
      {section === "audit" && <AuditLog />}
    </div>
  );
}
function SettingsForm({
  initial,
  onSaved,
}: {
  initial: Settings;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Settings>({
    zone: initial.zone || "",
    contactEmail: initial.contactEmail || "",
    contactPhone: initial.contactPhone || "",
    businessAddress: initial.businessAddress || "",
    legalName: initial.legalName || "",
    legalNotice: initial.legalNotice || "",
    proposalExpiryHours: initial.proposalExpiryHours,
  });
  const [saved, setSaved] = useState(false);
  const save = trpc.mds.settings.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      onSaved();
    },
  });
  const update = (key: keyof Settings, value: string | number) => {
    setSaved(false);
    setValues(previous => ({ ...previous, [key]: value }));
  };
  return (
    <form
      className="stack"
      onSubmit={e => {
        e.preventDefault();
        save.mutate(values);
      }}
    >
      <h3>Votre entreprise</h3>
      <div className="form-grid">
        <Field label="Identité légale">
          <input
            value={values.legalName}
            maxLength={200}
            onChange={e => update("legalName", e.target.value)}
          />
        </Field>
        <Field label="Adresse professionnelle">
          <input
            value={values.businessAddress}
            maxLength={500}
            onChange={e => update("businessAddress", e.target.value)}
          />
        </Field>
        <Field label="Email de contact">
          <input
            type="email"
            value={values.contactEmail}
            maxLength={320}
            onChange={e => update("contactEmail", e.target.value)}
          />
        </Field>
        <Field label="Téléphone de contact">
          <input
            type="tel"
            value={values.contactPhone}
            maxLength={30}
            onChange={e => update("contactPhone", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Zone d’intervention">
        <textarea
          rows={3}
          value={values.zone}
          maxLength={300}
          onChange={e => update("zone", e.target.value)}
        />
      </Field>
      <Field label="Mentions légales">
        <textarea
          rows={5}
          value={values.legalNotice}
          maxLength={10000}
          onChange={e => update("legalNotice", e.target.value)}
        />
      </Field>
      <h3>Validité des propositions</h3>
      <Field
        label="Délai d’expiration (heures)"
        hint="Contrôlé par le serveur à l’accès et aux actions. L’expiration autonome et les canaux email/SMS relèvent du prompt 2/3."
      >
        <input
          type="number"
          min="1"
          max="720"
          step="1"
          required
          value={values.proposalExpiryHours}
          onChange={e => update("proposalExpiryHours", Number(e.target.value))}
        />
      </Field>
      <ErrorNotice error={save.error} />
      {saved && (
        <p className="success-message" role="status">
          Paramètres enregistrés.
        </p>
      )}
      <ActionButton type="submit" className="primary" disabled={save.isPending}>
        {save.isPending ? "Enregistrement…" : "Enregistrer les paramètres"}
      </ActionButton>
    </form>
  );
}
function CatalogEditor({
  services,
  loading,
  error,
  retry,
  onChanged,
}: {
  services: Service[];
  loading: boolean;
  error: unknown;
  retry: () => unknown;
  onChanged: () => void;
}) {
  const [trade, setTrade] = useState("");
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [removing, setRemoving] = useState<Service | null>(null);
  const [success, setSuccess] = useState("");
  const remove = trpc.mds.catalog.remove.useMutation({
    onSuccess: () => {
      setRemoving(null);
      setSuccess("Prestation retirée du catalogue.");
      onChanged();
    },
  });
  const filtered = services.filter(
    service => !trade || service.trade === trade
  );
  return (
    <section className="panel stack">
      <div
        className="row"
        style={{ justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <div>
          <h3>Catalogue</h3>
          <p className="muted">Métier → prestation → type de problème.</p>
        </div>
        <ActionButton className="primary" onClick={() => setEditing("new")}>
          <Plus size={18} aria-hidden="true" />
          Ajouter une prestation
        </ActionButton>
      </div>
      <p className="notice">
        Une prestation inactive est une configuration interne, pas une offre
        disponible. Mode A : prix affiché avec inclusions, exclusions et frais
        de déplacement validés. Mode B : devis personnalisé après analyse.
        Vérifiez aussi durée, conditions et zone avant activation.
      </p>
      <Field label="Métier">
        <select value={trade} onChange={e => setTrade(e.target.value)}>
          <option value="">Tous les métiers</option>
          {trades.map(item => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <QueryState
        loading={loading}
        error={error}
        retry={retry}
        empty={!loading && !error && filtered.length === 0}
        emptyText="Aucune prestation dans cette sélection."
      />
      {success && (
        <p className="success-message" role="status">
          {success}
        </p>
      )}
      {!error && !loading && (
        <ul className="data-list" style={{ listStyle: "none", padding: 0 }}>
          {filtered.map(service => (
            <li
              key={service.id}
              className="data-row row"
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ flex: "1 1 220px" }}>
                <span className="eyebrow">
                  {trades.find(item => item.slug === service.trade)?.name}
                </span>
                <h4>{service.name}</h4>
                <p className="muted">
                  {service.pricingMode === "fixed"
                    ? `Mode A · Base ${money(service.priceCents)}`
                    : "Mode B · Devis personnalisé"}{" "}
                  · {service.durationMinutes} min ·{" "}
                  {service.problemTypes.length} type
                  {service.problemTypes.length !== 1 ? "s" : ""} de problème
                </p>
                <span className="badge">
                  {service.active
                    ? "Validée et active"
                    : "Inactive · à valider"}
                </span>
              </div>
              <div className="row">
                <ActionButton
                  onClick={() => setEditing(service)}
                  aria-label={`Modifier ${service.name}`}
                >
                  <Edit3 size={17} aria-hidden="true" />
                  Modifier
                </ActionButton>
                <ActionButton
                  className="secondary danger"
                  onClick={() => setRemoving(service)}
                  aria-label={`Supprimer ${service.name}`}
                >
                  <Trash2 size={17} aria-hidden="true" />
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ServiceForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSuccess("Prestation enregistrée.");
            onChanged();
          }}
        />
      )}
      {removing && (
        <PrivateModal
          title="Retirer cette prestation ?"
          description={`${removing.name} ne sera plus proposée dans le catalogue. Les dossiers existants doivent être conservés par le serveur.`}
          onClose={() => setRemoving(null)}
        >
          <ErrorNotice error={remove.error} />
          <div className="row">
            <ActionButton
              className="dark"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: removing.id })}
            >
              Confirmer le retrait
            </ActionButton>
            <ActionButton onClick={() => setRemoving(null)}>
              Retour
            </ActionButton>
          </div>
        </PrivateModal>
      )}
    </section>
  );
}
function ServiceForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Service;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<z.infer<typeof serviceSchema>>(() => ({
    ...(initial ? { id: initial.id } : {}),
    trade: initial?.trade ?? "plomberie",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    photoUrl: initial?.photoUrl ?? "",
    pricingMode: initial?.pricingMode ?? "quote",
    priceCents: initial?.priceCents ?? null,
    pricingRule: initial?.pricingRule ?? "",
    included: initial?.included ?? "",
    excluded: initial?.excluded ?? "",
    travelMode: initial?.travelMode ?? "unconfigured",
    travelFeeCents: initial?.travelFeeCents ?? null,
    travelRules: initial?.travelRules ?? [],
    durationMinutes: initial?.durationMinutes ?? 15,
    questions: initial?.questions ?? [],
    problemTypes: initial?.problemTypes ?? [],
    conditions: initial?.conditions ?? "",
    zone: initial?.zone ?? "",
    active: initial?.active ?? false,
  }));
  const [pricingDraft, setPricingDraft] = useState(() =>
    initialPricingDraft(initial)
  );
  const [questions, setQuestions] = useState(
    initial?.questions.join("\n") ?? ""
  );
  const [problems, setProblems] = useState(
    initial?.problemTypes.join("\n") ?? ""
  );
  const [validationConfirmed, setValidationConfirmed] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const save = trpc.mds.catalog.save.useMutation({ onSuccess: onSaved });
  const update = <K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K]
  ) => {
    setValidationConfirmed(false);
    setValues(previous => ({ ...previous, [key]: value }));
  };
  async function submit() {
    setError(null);
    try {
      if (values.active && !validationConfirmed)
        throw new Error(
          "Confirmez la validation de cette prestation avant de l’activer."
        );
      if (
        values.active &&
        values.pricingMode === "fixed" &&
        (!values.included.trim() ||
          !values.excluded.trim() ||
          !values.conditions.trim() ||
          values.travelMode === "unconfigured")
      )
        throw new Error(
          "Avant activation du mode A, précisez ce qui est inclus, non inclus, les conditions et validez les frais de déplacement."
        );
      const parsed = serviceSchema.safeParse({
        ...values,
        ...parsePricingDraft(pricingDraft),
        questions: questions
          .split("\n")
          .map(value => value.trim())
          .filter(Boolean),
        problemTypes: problems
          .split("\n")
          .map(value => value.trim())
          .filter(Boolean),
      });
      if (!parsed.success)
        throw new Error(
          parsed.error.issues.map(issue => issue.message).join(" ")
        );
      await save.mutateAsync(parsed.data);
    } catch (cause) {
      setError(cause);
    }
  }
  return (
    <PrivateModal
      title={initial ? "Modifier la prestation" : "Nouvelle prestation"}
      description="Cette configuration reste inactive tant que vous ne la validez pas explicitement."
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="form-grid">
          <Field label="Métier">
            <select
              value={values.trade}
              onChange={e =>
                update("trade", e.target.value as typeof values.trade)
              }
            >
              {trades.map(trade => (
                <option key={trade.slug} value={trade.slug}>
                  {trade.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nom de la prestation">
            <input
              required
              minLength={2}
              maxLength={120}
              value={values.name}
              onChange={e => update("name", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            rows={3}
            maxLength={600}
            value={values.description}
            onChange={e => update("description", e.target.value)}
          />
        </Field>
        <Field
          label="Photo publique (URL facultative)"
          hint="Une photo illustrative uniquement, jamais un document ou une photo de client."
        >
          <input
            type="url"
            maxLength={1000}
            value={values.photoUrl}
            onChange={e => update("photoUrl", e.target.value)}
          />
        </Field>
        <PricingEditor
          values={values}
          draft={pricingDraft}
          serviceId={initial?.id}
          serviceName={values.name}
          revision={initial?.pricingVersion}
          onChange={changes => {
            setValidationConfirmed(false);
            setValues(previous => ({
              ...previous,
              ...changes,
              travelRules: changes.travelRules ?? previous.travelRules,
            }));
          }}
          onDraftChange={draft => {
            setValidationConfirmed(false);
            setPricingDraft(draft);
          }}
        />
        <details open>
          <summary
            style={{
              minHeight: 44,
              cursor: "pointer",
              padding: "12px 0",
              fontWeight: 700,
            }}
          >
            Durée, conditions et zone d’intervention
          </summary>
          <div className="stack">
            <Field label="Durée indicative (minutes)">
              <input
                type="number"
                required
                min="15"
                max="1440"
                step="1"
                value={values.durationMinutes}
                onChange={e =>
                  update("durationMinutes", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Conditions d’intervention">
              <textarea
                rows={3}
                maxLength={1000}
                value={values.conditions}
                onChange={e => update("conditions", e.target.value)}
              />
            </Field>
            <Field label="Zone spécifique à la prestation">
              <input
                maxLength={300}
                value={values.zone}
                onChange={e => update("zone", e.target.value)}
              />
            </Field>
          </div>
        </details>
        <details>
          <summary
            style={{
              minHeight: 44,
              cursor: "pointer",
              padding: "12px 0",
              fontWeight: 700,
            }}
          >
            Types de problème et questions au client
          </summary>
          <div className="stack">
            <Field
              label="Types de problème"
              hint="Un type par ligne, 20 maximum, 120 caractères chacun."
            >
              <textarea
                rows={4}
                value={problems}
                onChange={e => {
                  setValidationConfirmed(false);
                  setProblems(e.target.value);
                }}
              />
            </Field>
            <Field
              label="Questions au client"
              hint="Une question par ligne, 10 maximum, 200 caractères chacune."
            >
              <textarea
                rows={4}
                value={questions}
                onChange={e => {
                  setValidationConfirmed(false);
                  setQuestions(e.target.value);
                }}
              />
            </Field>
          </div>
        </details>
        <div className="notice stack">
          <label className="row" style={{ minHeight: 44 }}>
            <input
              type="checkbox"
              checked={values.active}
              onChange={e => {
                update("active", e.target.checked);
                setValidationConfirmed(false);
              }}
            />
            <CheckCircle2 size={18} aria-hidden="true" />
            Prestation active dans le catalogue public
          </label>
          {values.active && (
            <label className="row" style={{ minHeight: 44 }}>
              <input
                type="checkbox"
                required
                checked={validationConfirmed}
                onChange={e => setValidationConfirmed(e.target.checked)}
              />
              Je valide le mode tarifaire, les inclusions et exclusions, les
              frais de déplacement, les informations et les conditions.
            </label>
          )}
        </div>
        <ErrorNotice error={error} />
        <div className="row">
          <ActionButton
            className="primary"
            type="submit"
            disabled={save.isPending}
          >
            <ShieldCheck size={18} aria-hidden="true" />
            {save.isPending
              ? "Enregistrement…"
              : values.active
                ? "Valider et activer"
                : "Enregistrer inactive"}
          </ActionButton>
          <ActionButton onClick={onClose} disabled={save.isPending}>
            Retour
          </ActionButton>
        </div>
      </form>
    </PrivateModal>
  );
}
function AuditLog() {
  const audit = trpc.mds.audit.list.useQuery(undefined, { retry: false });
  return (
    <section className="panel stack">
      <h3>Journal des opérations sensibles</h3>
      <p className="muted">
        Événements réellement enregistrés par le serveur, sans données secrètes.
      </p>
      <QueryState
        loading={audit.isLoading}
        error={audit.error}
        retry={audit.refetch}
        empty={audit.data?.length === 0}
        emptyText="Aucune opération sensible enregistrée."
      />
      <ul className="data-list" style={{ listStyle: "none", padding: 0 }}>
        {audit.data?.map(event => (
          <li key={event.id} className="data-row">
            <strong>{event.action}</strong>
            <p className="muted">
              {event.entityType}
              {event.entityId ? ` · ${event.entityId}` : ""} ·{" "}
              {dateTime(event.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
