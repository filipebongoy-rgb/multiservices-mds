import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ActionButton, ErrorNotice, Field, QueryState } from "./private-common";
import { dateTime, statusLabels } from "@shared/mds";

export function ClientsPanel() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [requestFilter, setRequestFilter] = useState<"all" | "open" | "done">(
    "all"
  );
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
            <div
              className="row"
              style={{ justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <h3>Demandes ({detail.data.requests.length})</h3>
              <div
                className="row"
                role="group"
                aria-label="Filtrer les demandes du client"
              >
                {(["all", "open", "done"] as const).map(filter => (
                  <ActionButton
                    key={filter}
                    className={requestFilter === filter ? "dark" : "secondary"}
                    aria-pressed={requestFilter === filter}
                    onClick={() => setRequestFilter(filter)}
                  >
                    {filter === "all"
                      ? "Toutes"
                      : filter === "open"
                        ? "En cours"
                        : "Terminées"}
                  </ActionButton>
                ))}
              </div>
            </div>
            {detail.data.requests.filter(request =>
              requestFilter === "all"
                ? true
                : requestFilter === "done"
                  ? ["completed", "invoiced", "paid", "closed"].includes(
                      request.status
                    )
                  : ![
                      "completed",
                      "invoiced",
                      "paid",
                      "closed",
                      "refused",
                      "cancelled",
                      "expired",
                    ].includes(request.status)
            ).length ? (
              detail.data.requests
                .filter(request =>
                  requestFilter === "all"
                    ? true
                    : requestFilter === "done"
                      ? ["completed", "invoiced", "paid", "closed"].includes(
                          request.status
                        )
                      : ![
                          "completed",
                          "invoiced",
                          "paid",
                          "closed",
                          "refused",
                          "cancelled",
                          "expired",
                        ].includes(request.status)
                )
                .map(request => (
                  <div className="data-row" key={request.id}>
                    <strong>{request.reference}</strong>
                    <span className="muted">
                      {request.serviceName || "Demande libre"} ·{" "}
                      {statusLabels[
                        request.status as keyof typeof statusLabels
                      ] || request.status}{" "}
                      · {dateTime(request.createdAt)}
                    </span>
                    <Link
                      className="text-link"
                      href={`/suivi?ref=${encodeURIComponent(request.reference)}`}
                    >
                      Ouvrir le suivi
                    </Link>
                  </div>
                ))
            ) : (
              <p className="muted">
                {requestFilter === "all"
                  ? "Aucune demande enregistrée."
                  : "Aucun dossier dans ce filtre."}
              </p>
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
