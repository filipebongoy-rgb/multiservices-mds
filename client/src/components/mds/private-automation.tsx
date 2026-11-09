import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { dateTime } from "@shared/mds";
import { ActionButton, ErrorNotice, Field, QueryState } from "./private-common";

const initial = {
  remindersEnabled: false,
  reminderHours: 24,
  proposalReminderHours: 6,
  emailEnabled: false,
  smsEnabled: false,
  publicOrigin: "",
  emailFrom: "",
  smsFrom: "",
};
const messageLabels: Record<string, string> = {
  queued: "À envoyer",
  sending: "Traitement en cours",
  accepted: "Accepté par le fournisseur",
  delivered: "Livré — preuve fournisseur",
  failed: "Échec",
  disabled: "Canal désactivé",
  uncertain: "À vérifier avant reprise",
  cancelled: "Annulé",
};
export function AutomationSettings() {
  const data = trpc.mds.automation.get.useQuery(undefined, { retry: false });
  const [form, setForm] = useState(initial),
    [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (data.data && !dirty) setForm(data.data.settings);
  }, [data.data, dirty]);
  const save = trpc.mds.automation.save.useMutation({
    onSuccess: () => {
      setDirty(false);
      setNotice("Réglages enregistrés.");
      void data.refetch();
    },
  });
  const run = trpc.mds.automation.run.useMutation({
      onSuccess: r => {
        setNotice(
        `${r.expired} expiration(s), ${r.reminders} rappel(s), ${r.appointmentsConfirmed} rendez-vous confirmé(s), ${r.requestsClosed} dossier(s) clôturé(s), ${r.messagesAccepted} message(s) accepté(s).`
        );
      void data.refetch();
    },
  });
  const sync = trpc.mds.automation.sync.useMutation({
    onSuccess: () => void data.refetch(),
  });
  const retry = trpc.mds.automation.retry.useMutation({
    onSuccess: () => void data.refetch(),
  });
  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    setDirty(true);
    setForm(f => ({ ...f, [key]: value }));
  };
  return (
    <details className="panel stack">
      <summary className="simple-summary">Notifications et rappels</summary>
      <div className="stack" style={{ marginTop: 16 }}>
        <QueryState
          loading={data.isLoading}
          error={data.error}
          retry={data.refetch}
        />
        {data.data && (
          <>
            <p className="notice">
              {data.data.autonomous.enabled
                ? "Traitement autonome activé."
                : "Traitement autonome non activé : publication et enregistrement de la tâche nécessaires."}
              {data.data.autonomous.lastRunAt &&
                ` Dernier passage : ${dateTime(data.data.autonomous.lastRunAt)}.`}
            </p>
            <form
              className="stack"
              onSubmit={e => {
                e.preventDefault();
                setNotice("");
                save.mutate(form);
              }}
            >
              <label className="row">
                <input
                  type="checkbox"
                  checked={form.remindersEnabled}
                  onChange={e => set("remindersEnabled", e.target.checked)}
                />
                Préparer les rappels
              </label>
              {form.remindersEnabled && (
                <div className="form-grid">
                  <Field label="Avant le rendez-vous (heures)">
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={form.reminderHours}
                      onChange={e =>
                        set("reminderHours", Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Avant expiration (heures)">
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={form.proposalReminderHours}
                      onChange={e =>
                        set("proposalReminderHours", Number(e.target.value))
                      }
                    />
                  </Field>
                </div>
              )}
              <details>
                <summary className="simple-summary">
                  Canaux e-mail et SMS
                </summary>
                <div className="stack" style={{ marginTop: 12 }}>
                  <p className="muted">
                    Resend :{" "}
                    {data.data.providers.email
                      ? "clé disponible"
                      : "non configuré"}
                    . Twilio :{" "}
                    {data.data.providers.sms
                      ? "clés disponibles"
                      : "non configuré"}
                    .
                  </p>
                  <Field label="Adresse HTTPS publique de MDS">
                    <input
                      type="url"
                      value={form.publicOrigin}
                      placeholder="https://votre-domaine.fr"
                      onChange={e => set("publicOrigin", e.target.value)}
                    />
                  </Field>
                  <Field label="Expéditeur e-mail vérifié">
                    <input
                      type="email"
                      value={form.emailFrom}
                      onChange={e => set("emailFrom", e.target.value)}
                    />
                  </Field>
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={form.emailEnabled}
                      disabled={!data.data.providers.email}
                      onChange={e => set("emailEnabled", e.target.checked)}
                    />
                    Activer l’e-mail
                  </label>
                  <Field label="Expéditeur SMS (international ou autorisé par Twilio)">
                    <input
                      value={form.smsFrom}
                      onChange={e => set("smsFrom", e.target.value)}
                    />
                  </Field>
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={form.smsEnabled}
                      disabled={!data.data.providers.sms}
                      onChange={e => set("smsEnabled", e.target.checked)}
                    />
                    Activer le SMS
                  </label>
                </div>
              </details>
              <ErrorNotice error={save.error} />
              <ActionButton
                type="submit"
                className="primary"
                disabled={save.isPending || !dirty}
              >
                Enregistrer
              </ActionButton>
            </form>
            <details>
              <summary className="simple-summary">
                Contrôle et reprise manuelle
              </summary>
              <div className="stack" style={{ marginTop: 12 }}>
                <ActionButton
                  disabled={run.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Traiter les expirations, les rappels et les messages en attente ? Les canaux activés pourront envoyer de vrais messages."
                      )
                    )
                      run.mutate({ confirmed: true });
                  }}
                >
                  Traiter maintenant
                </ActionButton>
                <ErrorNotice error={run.error || retry.error || sync.error} />
                <p className="muted">
                  « Accepté » n’est pas une preuve de livraison. Un résultat
                  inconnu exige une vérification du fournisseur avant reprise.
                </p>
                {data.data.outbox.length === 0 ? (
                  <p className="muted">Aucun message externe enregistré.</p>
                ) : (
                  data.data.outbox.slice(0, 20).map(m => (
                    <div className="data-row stack" key={m.id}>
                      <strong>{m.subject}</strong>
                      <span>
                        {m.channel === "email" ? "E-mail" : "SMS"} ·{" "}
                        {messageLabels[m.status]}
                      </span>
                      <small>{dateTime(m.createdAt)}</small>
                      {m.lastError && <p className="muted">{m.lastError}</p>}
                      {["failed", "disabled", "uncertain"].includes(
                        m.status
                      ) && (
                        <ActionButton
                          disabled={retry.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                "J’ai vérifié chez le fournisseur que ce message n’a pas été envoyé. Le remettre en attente ?"
                              )
                            )
                              retry.mutate({
                                id: m.id,
                                confirmedNotSent: true,
                              });
                          }}
                        >
                          Reprendre après vérification
                        </ActionButton>
                      )}
                    </div>
                  ))
                )}
                <details>
                  <summary className="simple-summary">
                    Journal des traitements
                  </summary>
                  {data.data.runs.slice(0, 10).map(r => (
                    <div className="data-row" key={r.id}>
                      {dateTime(r.startedAt)} ·{" "}
                      {r.source === "manual" ? "Manuel" : "Autonome"} ·{" "}
                      {r.status === "succeeded"
                        ? "Terminé"
                        : r.status === "failed"
                          ? "Échec"
                          : "En cours"}
                    </div>
                  ))}
                </details>
              </div>
            </details>
          </>
        )}
        {notice && (
          <p role="status" className="success-message">
            {notice}
          </p>
        )}
      </div>
    </details>
  );
}
