import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ActionButton, ErrorNotice, Field, QueryState } from "./private-common";
import { dateTime } from "@shared/mds";

export function ClientsPanel() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const list = trpc.mds.clients.list.useQuery(search ? { search } : undefined, {
    retry: false,
  });
  const detail = trpc.mds.clients.detail.useQuery(
    { id: selected || 0 },
    { enabled: selected != null, retry: false }
  );
  return (
    <section className="panel stack" aria-label="Fiches clients">
      <div className="section-heading">
        <h2>Clients</h2>
        <p className="muted">
          Une fiche par personne, avec son historique réel.
        </p>
      </div>
      <Field label="Rechercher">
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Nom, e-mail ou téléphone"
        />
      </Field>
      <QueryState
        loading={list.isLoading}
        error={list.error}
        retry={list.refetch}
      />
      {list.data &&
        (list.data.length ? (
          <div className="data-list">
            {list.data.map(client => (
              <button
                key={client.id}
                className="data-row"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => setSelected(client.id)}
              >
                <strong>{client.name}</strong>
                <span className="muted">
                  {client.email} · {client.phone}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">Aucune fiche client trouvée.</div>
        ))}
      {detail.error && <ErrorNotice error={detail.error} />}
      {detail.data && (
        <details open className="panel">
          <summary>{detail.data.client.name}</summary>
          <div className="stack" style={{ paddingTop: 12 }}>
            <p>
              {detail.data.client.email}
              <br />
              {detail.data.client.phone}
            </p>
            <h3>Demandes</h3>
            {detail.data.requests.length ? (
              detail.data.requests.map(request => (
                <div className="data-row" key={request.id}>
                  <strong>{request.reference}</strong>
                  <span className="muted">
                    {request.serviceName || "Demande libre"} · {request.status}{" "}
                    · {dateTime(request.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">Aucune demande enregistrée.</p>
            )}
            <ActionButton onClick={() => setSelected(null)}>
              Fermer la fiche
            </ActionButton>
          </div>
        </details>
      )}
    </section>
  );
}
