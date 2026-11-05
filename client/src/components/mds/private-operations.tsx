import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { money, dateTime } from "@shared/mds";
import { incidentSchema, extraWorkSchema } from "@shared/operations";
import type { z } from "zod";
import type { MdsOutputs } from "./private-types";
import {
  ActionButton,
  ErrorNotice,
  Field,
  PrivateModal,
  UploadDocument,
} from "./private-common";
import { parseEuroCents } from "./private-pricing";

type Detail = MdsOutputs["requests"]["detail"];
const kinds = {
  problem: "Problème sur place",
  client_absent: "Client absent",
  artisan_unavailable: "Artisan indisponible",
  no_slot: "Aucun créneau",
  payment_failed: "Paiement échoué",
  complaint: "Réclamation",
} as const;
const extraLabels = {
  pending: "Accord client attendu",
  accepted: "Accepté — non commencé",
  refused: "Refusé / expiré",
  cancelled: "Annulé",
  in_progress: "En cours",
  completed: "Terminé",
} as const;
export function PrivateOperations({
  detail,
  onChanged,
}: {
  detail: Detail;
  onChanged: () => Promise<unknown>;
}) {
  const r = detail.request;
  const [modal, setModal] = useState<"incident" | "extra" | null>(null);
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<unknown>(null);
  const report = trpc.mds.operations.report.useMutation();
  const resolve = trpc.mds.operations.resolve.useMutation();
  const propose = trpc.mds.operations.proposeExtra.useMutation();
  const start = trpc.mds.operations.startExtra.useMutation();
  const complete = trpc.mds.operations.completeExtra.useMutation();
  const cancel = trpc.mds.operations.cancelExtra.useMutation();
  const pending =
    report.isPending ||
    resolve.isPending ||
    propose.isPending ||
    start.isPending ||
    complete.isPending ||
    cancel.isPending;
  const incidents = detail.incidents;
  const extras = detail.extraWorks;
  const open = incidents.filter(row => row.status === "open");
  const afterPhotos = detail.documents.filter(
    document => document.kind === "photo" && document.photoStage === "after"
  );
  async function run(action: () => Promise<unknown>, close = false) {
    setError(null);
    try {
      await action();
      if (close) {
        setModal(null);
        setResolveId(null);
        setResolution("");
      }
      await onChanged();
    } catch (cause) {
      setError(cause);
      await onChanged();
    }
  }
  return (
    <details
      className="stack"
      open={
        open.length > 0 ||
        extras.some(row => ["accepted", "in_progress"].includes(row.status))
      }
    >
      <summary
        style={{
          minHeight: 44,
          padding: "12px 0",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Incidents et travaux supplémentaires
        {open.length ? ` · ${open.length} à traiter` : ""}
      </summary>
      <ErrorNotice error={error} />
      <div className="row" style={{ flexWrap: "wrap" }}>
        <ActionButton disabled={pending} onClick={() => setModal("incident")}>
          Signaler un problème
        </ActionButton>
        {["planned", "en_route", "in_progress"].includes(r.status) && (
          <ActionButton disabled={pending} onClick={() => setModal("extra")}>
            Travaux en plus
          </ActionButton>
        )}
      </div>
      {incidents.map(row => (
        <article key={row.id} className="notice stack">
          <strong>
            {kinds[row.kind]} · {row.status === "open" ? "Ouvert" : "Résolu"}
          </strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{row.message}</p>
          <small className="muted">{dateTime(row.createdAt)}</small>
          {row.status === "open" &&
            ["problem", "client_absent", "artisan_unavailable"].includes(
              row.kind
            ) && <p>Début et fin des travaux suspendus jusqu’à résolution.</p>}
          {row.resolution && <p>Résolution : {row.resolution}</p>}
          {row.status === "open" && (
            <ActionButton
              disabled={pending}
              onClick={() => {
                setResolveId(row.id);
                setResolution("");
              }}
            >
              Enregistrer la résolution
            </ActionButton>
          )}
        </article>
      ))}
      {r.status === "in_progress" && (
        <section className="notice stack">
          <strong>Photo après travaux</strong>
          <p>
            Ajoutez au moins une photo nette du résultat avant de terminer
            l’intervention. Elle sera visible par le client dans son suivi.
          </p>
          {afterPhotos.length > 0 && (
            <p className="success-message" role="status">
              {afterPhotos.length} photo{afterPhotos.length > 1 ? "s" : ""}{" "}
              après travaux déjà ajoutée{afterPhotos.length > 1 ? "s" : ""}.
            </p>
          )}
          <UploadDocument
            reference={r.reference}
            kind="photo"
            photoStage="after"
            onUploaded={onChanged}
          />
        </section>
      )}
      {extras.map(extra => (
        <article className="notice stack" key={extra.id}>
          <strong>
            Supplément n° {extra.id} · {extraLabels[extra.status]}
          </strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{extra.scope}</p>
          <p>
            {money(extra.amountCents)} · {extra.durationMinutes} min
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{extra.conditions}</p>
          {extra.expiresAt && (
            <small>Accord avant le {dateTime(extra.expiresAt)}</small>
          )}
          <div className="row" style={{ flexWrap: "wrap" }}>
            {extra.status === "accepted" && r.status === "in_progress" && (
              <ActionButton
                disabled={pending}
                onClick={() =>
                  void run(() =>
                    start.mutateAsync({ id: extra.id, version: extra.version })
                  )
                }
              >
                Démarrer le supplément
              </ActionButton>
            )}
            {extra.status === "in_progress" && r.status === "in_progress" && (
              <ActionButton
                disabled={pending}
                onClick={() =>
                  void run(() =>
                    complete.mutateAsync({
                      id: extra.id,
                      version: extra.version,
                    })
                  )
                }
              >
                Terminer le supplément
              </ActionButton>
            )}
            {["pending", "accepted"].includes(extra.status) && (
              <ActionButton
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Annuler ce supplément avant exécution ? Il ne sera pas facturé."
                    )
                  )
                    void run(() =>
                      cancel.mutateAsync({
                        id: extra.id,
                        version: extra.version,
                      })
                    );
                }}
              >
                Annuler ce supplément
              </ActionButton>
            )}
          </div>
        </article>
      ))}
      {modal === "incident" && (
        <IncidentForm
          pending={pending}
          error={error}
          onClose={() => setModal(null)}
          onSubmit={value =>
            run(
              () =>
                report.mutateAsync({
                  ...value,
                  requestId: r.id,
                  version: r.version,
                }),
              true
            )
          }
        />
      )}
      {modal === "extra" && (
        <ExtraForm
          documents={detail.documents}
          pending={pending}
          error={error}
          onClose={() => setModal(null)}
          onSubmit={value =>
            run(
              () =>
                propose.mutateAsync({
                  ...value,
                  requestId: r.id,
                  version: r.version,
                }),
              true
            )
          }
        />
      )}
      {resolveId && (
        <PrivateModal
          title="Résoudre l’incident"
          description="Le dossier conserve son état actuel."
          onClose={() => setResolveId(null)}
        >
          <form
            className="stack"
            onSubmit={e => {
              e.preventDefault();
              void run(
                () =>
                  resolve.mutateAsync({
                    id: resolveId,
                    requestVersion: r.version,
                    resolution,
                  }),
                true
              );
            }}
          >
            <Field label="Résolution réelle">
              <textarea
                minLength={5}
                maxLength={3000}
                required
                rows={4}
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              />
            </Field>
            <ErrorNotice error={error} />
            <ActionButton type="submit" disabled={pending}>
              Enregistrer
            </ActionButton>
          </form>
        </PrivateModal>
      )}
    </details>
  );
}
function IncidentForm({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (
    value: Omit<z.infer<typeof incidentSchema>, "requestId" | "version">
  ) => Promise<unknown>;
}) {
  const [kind, setKind] =
    useState<z.infer<typeof incidentSchema>["kind"]>("problem");
  const [message, setMessage] = useState("");
  return (
    <PrivateModal
      title="Signaler un problème"
      description="Horodaté dans le suivi, sans progression fictive."
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          void onSubmit({ kind, message });
        }}
      >
        <Field label="Situation">
          <select
            value={kind}
            onChange={e => setKind(e.target.value as typeof kind)}
          >
            {Object.entries(kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Que s’est-il passé ?">
          <textarea
            rows={4}
            minLength={5}
            maxLength={3000}
            required
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </Field>
        <ErrorNotice error={error} />
        <ActionButton type="submit" disabled={pending}>
          Signaler
        </ActionButton>
      </form>
    </PrivateModal>
  );
}
function ExtraForm({
  documents,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  documents: Detail["documents"];
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (
    value: Omit<z.infer<typeof extraWorkSchema>, "requestId" | "version">
  ) => Promise<unknown>;
}) {
  const [scope, setScope] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [conditions, setConditions] = useState("");
  const [documentId, setDocument] = useState("");
  const [localError, setLocalError] = useState<unknown>(null);
  return (
    <PrivateModal
      title="Proposer des travaux en plus"
      description="Le client doit accepter ce périmètre et ce prix avant tout démarrage."
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          setLocalError(null);
          try {
            const amountCents = parseEuroCents(amount, "Prix du supplément");
            if (amountCents == null) throw new Error("Précisez le prix.");
            void onSubmit({
              scope,
              amountCents,
              durationMinutes: Number(duration),
              conditions,
              documentId: documentId ? Number(documentId) : null,
            });
          } catch (cause) {
            setLocalError(cause);
          }
        }}
      >
        <Field label="Travaux précis">
          <textarea
            rows={3}
            minLength={10}
            maxLength={3000}
            required
            value={scope}
            onChange={e => setScope(e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="Total TTC (€)">
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Durée (min)">
            <input
              required
              type="number"
              min={1}
              max={1440}
              value={duration}
              onChange={e => setDuration(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Conditions et exclusions">
          <textarea
            rows={3}
            minLength={5}
            maxLength={3000}
            required
            value={conditions}
            onChange={e => setConditions(e.target.value)}
          />
        </Field>
        <Field label="Document associé (facultatif)">
          <select
            value={documentId}
            onChange={e => setDocument(e.target.value)}
          >
            <option value="">Aucun</option>
            {documents.map(doc => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </Field>
        <ErrorNotice error={localError ?? error} />
        <ActionButton type="submit" disabled={pending}>
          Demander l’accord client
        </ActionButton>
      </form>
    </PrivateModal>
  );
}
