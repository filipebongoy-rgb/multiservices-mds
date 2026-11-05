import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { dateTime, money } from "@shared/mds";
import { ApiError } from "./Layout";

type Detail = inferRouterOutputs<AppRouter>["mds"]["requests"]["track"];
const labels: Record<string, string> = {
  pending: "Votre accord est attendu",
  accepted: "Accepté, pas encore exécuté",
  refused: "Refusé",
  cancelled: "Annulé ou expiré",
  in_progress: "Travaux démarrés par MDS",
  completed: "Travaux terminés par MDS",
};
export function ClientOperations({
  detail,
  token,
  onChanged,
}: {
  detail: Detail;
  token?: string;
  onChanged: () => unknown;
}) {
  const [message, setMessage] = useState(""),
    [notice, setNotice] = useState("");
  const extra = trpc.mds.operations.respondExtra.useMutation({
    onSuccess: () => {
      setNotice("Votre accord a été enregistré.");
      onChanged();
    },
    onError: () => onChanged(),
  });
  const complaint = trpc.mds.operations.complaint.useMutation({
    onSuccess: () => {
      setMessage("");
      setNotice("Votre réclamation est enregistrée pour MDS.");
      onChanged();
    },
    onError: () => onChanged(),
  });
  const confirmCompletion = trpc.mds.requests.clientAction.useMutation({
    onSuccess: () => {
      setMessage("");
      setNotice("Votre confirmation de fin est enregistrée.");
      onChanged();
    },
    onError: () => onChanged(),
  });
  return (
    <>
      {detail.request.status === "completed" &&
        detail.intervention?.completedAt &&
        !detail.intervention.clientConfirmedAt && (
          <section className="panel stack">
            <h2 style={{ fontSize: 22 }}>Fin des travaux</h2>
            <p>
              Vérifiez les photos après travaux. Votre absence de réponse ne
              vaut pas validation automatique.
            </p>
            <textarea
              rows={3}
              maxLength={3000}
              placeholder="Commentaire facultatif"
              value={message}
              onChange={event => setMessage(event.target.value)}
            />
            <button
              className="btn primary"
              disabled={confirmCompletion.isPending}
              onClick={() =>
                confirmCompletion.mutate({
                  reference: detail.request.reference,
                  token,
                  version: detail.request.version,
                  action: "confirmCompletion",
                  message: message.trim() || undefined,
                })
              }
            >
              Confirmer que les travaux sont terminés
            </button>
            {confirmCompletion.error && (
              <ApiError message={confirmCompletion.error.message} />
            )}
          </section>
        )}
      {detail.extraWorks.length > 0 && (
        <section className="panel stack">
          <h2 style={{ fontSize: 22 }}>Travaux supplémentaires</h2>
          {detail.extraWorks.map(work => (
            <div className="data-row stack" key={work.id}>
              <strong>{work.scope}</strong>
              <p>
                {money(work.amountCents)} · {work.durationMinutes} min
              </p>
              <p className="small-text">{work.conditions}</p>
              <span className="badge">{labels[work.status]}</span>
              {work.expiresAt && (
                <small>Valable jusqu’au {dateTime(work.expiresAt)}</small>
              )}
              {work.status === "pending" && (
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <button
                    className="btn primary"
                    disabled={extra.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Autoriser ces travaux supplémentaires : ${work.scope}\nMontant : ${money(work.amountCents)}\nConditions : ${work.conditions}\nMDS pourra ensuite en déclarer le démarrage.`
                        )
                      )
                        extra.mutate({
                          reference: detail.request.reference,
                          token,
                          id: work.id,
                          version: work.version,
                          accept: true,
                        });
                    }}
                  >
                    Accepter ce supplément
                  </button>
                  <button
                    className="btn secondary"
                    disabled={extra.isPending}
                    onClick={() =>
                      extra.mutate({
                        reference: detail.request.reference,
                        token,
                        id: work.id,
                        version: work.version,
                        accept: false,
                      })
                    }
                  >
                    Refuser
                  </button>
                </div>
              )}
            </div>
          ))}
          {extra.error && <ApiError message={extra.error.message} />}
        </section>
      )}
      {detail.incidents.length > 0 && (
        <details className="panel">
          <summary className="simple-summary">Incidents et résolution</summary>
          {detail.incidents.map(incident => (
            <div className="data-row" key={incident.id}>
              <strong>
                {incident.status === "resolved" ? "Résolu" : "À traiter"}
              </strong>
              <p>{incident.message}</p>
              {incident.resolution && <p>{incident.resolution}</p>}
              <small>
                {dateTime(incident.createdAt)}
                {incident.resolvedAt
                  ? ` · Résolu le ${dateTime(incident.resolvedAt)}`
                  : ""}
              </small>
            </div>
          ))}
        </details>
      )}
      <details className="panel">
        <summary className="simple-summary">Signaler un problème à MDS</summary>
        <form
          className="stack"
          style={{ marginTop: 12 }}
          onSubmit={e => {
            e.preventDefault();
            complaint.mutate({
              reference: detail.request.reference,
              token,
              version: detail.request.version,
              message,
            });
          }}
        >
          <div className="field">
            <label htmlFor="complaint">Votre message</label>
            <textarea
              id="complaint"
              rows={3}
              value={message}
              minLength={5}
              maxLength={3000}
              required
              onChange={e => setMessage(e.target.value)}
            />
          </div>
          {complaint.error && <ApiError message={complaint.error.message} />}
          <button className="btn secondary" disabled={complaint.isPending}>
            Envoyer à MDS
          </button>
        </form>
      </details>
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
