import { PaymentTools } from "./private-payment-tools";
import { useEffect, useRef, useState } from "react";
import { PrivateOperations } from "./private-operations";
import { PrivateQuoteBuilder } from "./private-quote-builder";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Pen,
  Play,
  Search,
  SquareCheck,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  artisanActionSchema,
  dateTime,
  money,
  statusLabels,
} from "@shared/mds";
import type { z } from "zod";
import {
  ActionButton,
  DocumentList,
  ErrorNotice,
  Field,
  PrivateModal,
  QueryState,
  StatusBadge,
  UploadDocument,
} from "./private-common";
import {
  dateInput,
  editableRequestStatuses,
  type RequestRecord,
  type Service,
} from "./private-types";
import {
  euroInput,
  parseEuroCents,
  PricingSnapshotSummary,
} from "./private-pricing";
import { SignaturePad } from "./SignaturePad";

function SignatureThumb({ id, reference }: { id: number; reference: string }) {
  const download = trpc.mds.documents.download.useMutation();
  const [url, setUrl] = useState("");
  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    download
      .mutateAsync({ id, reference })
      .then(file => {
        if (cancelled) return;
        const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: file.mimeType })
        );
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reference]);
  if (!url)
    return <div className="muted small-text">Chargement de la signature…</div>;
  return (
    <img
      src={url}
      alt="Signature du client"
      style={{
        maxWidth: 320,
        maxHeight: 120,
        background: "#fff",
        border: "1px solid #e7e5e2",
        borderRadius: 6,
        padding: 4,
      }}
    />
  );
}

type ArtisanAction = z.infer<typeof artisanActionSchema>["action"];
const actionLabels: Record<ArtisanAction, string> = {
  accept: "Accepter la demande",
  refuse: "Refuser la demande",
  propose: "Proposer un autre créneau",
  information: "Demander des précisions",
  photo: "Demander une photo",
  diagnostic: "Organiser un diagnostic",
  depart: "Démarrer le trajet",
  arrived: "Confirmer mon arrivée",
  quote: "Soumettre un devis",
  start: "Commencer l’intervention",
  complete: "Terminer l’intervention",
  cancel: "Annuler la demande",
  invoice: "Marquer la facture émise",
  paid: "Confirmer le paiement",
  close: "Clôturer le dossier",
};

function proposalPrice(request: RequestRecord, service?: Service) {
  if (request.quoteStatus === "accepted") return request.proposedPriceCents;
  if (request.pricingSnapshot) return request.pricingSnapshot.totalCents;
  return request.proposedPriceCents ?? service?.priceCents ?? null;
}

function quoteRequired(request: RequestRecord) {
  return (
    request.quoteStatus === "pending" ||
    request.quoteStatus === "refused" ||
    (request.pricingSnapshot?.requiresQuote === true &&
      request.quoteStatus !== "accepted")
  );
}

function requestPriority(request: RequestRecord) {
  const urgency = request.answers?.__urgency;
  if (
    urgency === "urgent" &&
    ["needs_information", "to_analyze", "awaiting_mds"].includes(request.status)
  )
    return -1;
  if (
    ["needs_information", "to_analyze", "awaiting_mds"].includes(request.status)
  )
    return 0;
  if (
    ["proposed_slot", "awaiting_client", "quote_pending"].includes(
      request.status
    )
  )
    return 1;
  return 2;
}
function urgencyLabel(request: RequestRecord) {
  return request.answers?.__urgency === "urgent" ? "Urgent" : null;
}

export function ArtisanRequests({
  requests,
  services,
  selectedId,
  onSelect,
  loading,
  error,
  retry,
  onChanged,
  listOnly = false,
}: {
  requests: RequestRecord[];
  services: Service[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  loading: boolean;
  error: unknown;
  retry: () => unknown;
  onChanged: () => void;
  listOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const archiveMutation = trpc.mds.requests.archive.useMutation();
  const detailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (selectedId === null || listOnly) return;
    const frame = window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      detailRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);
  const select = (id: number | null) => {
    onSelect(id);
  };
  const archive = async (request: RequestRecord) => {
    if (!window.confirm(`Retirer définitivement l’affichage du dossier ${request.reference} ?`)) return;
    try {
      await archiveMutation.mutateAsync({ id: request.id, confirmation: "SUPPRIMER" });
      if (selectedId === request.id) onSelect(null);
      onChanged();
    } catch {
      /* ErrorNotice is shown by the parent query on the next refresh. */
    }
  };
  const filtered = requests
    .filter(
      request =>
        (!status || request.status === status) &&
        `${request.reference} ${request.name} ${request.serviceName ?? ""} ${request.city}`
          .toLocaleLowerCase("fr")
          .includes(search.toLocaleLowerCase("fr"))
    )
    .sort((a, b) => {
      const priority = requestPriority(a) - requestPriority(b);
      if (priority) return priority;
      return (
        new Date(a.expiresAt ?? a.createdAt).getTime() -
        new Date(b.expiresAt ?? b.createdAt).getTime()
      );
    });
  return (
    <div className="stack">
      <div className="artisan-filter-bar">
        <div className="artisan-search-box">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (référence, client, ville)…"
            aria-label="Rechercher une demande"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          aria-label="Filtrer par état du dossier"
          className="artisan-status-select"
        >
          <option value="">Tous les états</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <QueryState loading={loading} error={error} retry={retry} />
      <ErrorNotice error={archiveMutation.error} />
      {!loading && !error && (
        listOnly ? (
          <div className="panel stack artisan-list-panel" style={{ minWidth: 0 }}>
            <p className="muted">
              {filtered.length} dossier{filtered.length !== 1 ? "s" : ""} ·
              actions urgentes en premier
            </p>
            {filtered.length === 0 ? (
              <div className="empty">
                {requests.length
                  ? "Aucune demande ne correspond à votre recherche."
                  : "Aucune demande reçue pour le moment."}
              </div>
            ) : (
              <ul className="data-list" style={{ listStyle: "none", padding: 0 }}>
                {filtered.map(request => (
                  <li key={request.id} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #e7e5e2" }}>
                    <button
                      className="data-row"
                      type="button"
                      onClick={() => select(request.id)}
                      aria-pressed={selectedId === request.id}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "16px 12px",
                        minHeight: 72,
                        background: selectedId === request.id ? "#fff3ed" : "transparent",
                        border: "none",
                        borderBottom: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        borderLeft: selectedId === request.id ? "4px solid #bc4c23" : "4px solid transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                            <strong>{request.name}</strong>
                            <span className="eyebrow">{request.reference}</span>
                          </div>
                          <p>{request.serviceName || "Demande libre"} · {request.city}</p>
                          <StatusBadge status={request.status} />
                          {urgencyLabel(request) && (
                            <span className="badge" style={{ marginLeft: 6, background: "#fff0e8", color: "#a53d18" }}>
                              Urgent
                            </span>
                          )}
                          {requestPriority(request) < 2 && (
                            <span className="badge" style={{ marginLeft: 6 }}>Action requise</span>
                          )}
                          <p className="muted" style={{ marginTop: 8 }}>{dateTime(request.createdAt)}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#bc4c23", fontSize: 13, fontWeight: 600, flexShrink: 0 }} aria-hidden="true">
                          <span>Ouvrir</span>
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </button>
                    {["cancelled", "refused", "expired", "closed", "completed", "paid", "invoiced"].includes(request.status) && (
                      <button type="button" className="icon-button" aria-label={`Retirer ${request.reference}`} title="Retirer ce dossier" onClick={() => void archive(request)} disabled={archiveMutation.isPending} style={{ alignSelf: "center", margin: "0 8px", color: "#a33d2a" }}>
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <div
          className="split-view artisan-split"
          style={{ alignItems: "start" }}
        >
          <div
            className={`panel stack artisan-list-panel${
              selectedId ? " artisan-list-panel--hidden-mobile" : ""
            }`}
            style={{ minWidth: 0 }}
          >
            <p className="muted">
              {filtered.length} dossier{filtered.length !== 1 ? "s" : ""} ·
              actions urgentes en premier
            </p>
            {filtered.length === 0 ? (
              <div className="empty">
                {requests.length
                  ? "Aucune demande ne correspond à votre recherche."
                  : "Aucune demande reçue pour le moment."}
              </div>
            ) : (
              <ul
                className="data-list"
                style={{ listStyle: "none", padding: 0 }}
              >
                {filtered.map(request => (
                  <li key={request.id} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #e7e5e2" }}>
                    <button
                      className="data-row"
                      type="button"
                      onClick={() => select(request.id)}
                      aria-pressed={selectedId === request.id}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "16px 12px",
                        minHeight: 72,
                        background:
                          selectedId === request.id ? "#fff3ed" : "transparent",
                        border: "none",
                        borderBottom: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        borderLeft:
                          selectedId === request.id
                            ? "4px solid #bc4c23"
                            : "4px solid transparent",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            className="row"
                            style={{
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                            }}
                          >
                            <strong>{request.name}</strong>
                            <span className="eyebrow">{request.reference}</span>
                          </div>
                          <p>
                            {request.serviceName || "Demande libre"} ·{" "}
                            {request.city}
                          </p>
                          <StatusBadge status={request.status} />
                          {urgencyLabel(request) && (
                            <span
                              className="badge"
                              style={{
                                marginLeft: 6,
                                background: "#fff0e8",
                                color: "#a53d18",
                              }}
                            >
                              Urgent
                            </span>
                          )}
                          {requestPriority(request) < 2 && (
                            <span className="badge" style={{ marginLeft: 6 }}>
                              Action requise
                            </span>
                          )}
                          <p className="muted" style={{ marginTop: 8 }}>
                            {dateTime(request.createdAt)}
                          </p>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            color: "#bc4c23",
                            fontSize: 13,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        >
                          <span>Ouvrir</span>
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </button>
                    {["cancelled", "refused", "expired", "closed", "completed", "paid", "invoiced"].includes(request.status) && (
                      <button type="button" className="icon-button" aria-label={`Retirer ${request.reference}`} title="Retirer ce dossier" onClick={() => void archive(request)} disabled={archiveMutation.isPending} style={{ alignSelf: "center", margin: "0 8px", color: "#a33d2a" }}>
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div
            className={`artisan-detail-panel${
              !selectedId ? " artisan-detail-panel--hidden-mobile" : ""
            }`}
            ref={detailRef}
            tabIndex={selectedId ? -1 : undefined}
            style={{ minWidth: 0, scrollMarginTop: 16 }}
          >
            {selectedId ? (
              <RequestDetail
                key={selectedId}
                id={selectedId}
                services={services}
                onBack={() => onSelect(null)}
                onChanged={onChanged}
              />
            ) : (
              <div className="panel empty">
                <FileText size={30} aria-hidden="true" />
                <p>Sélectionnez une demande pour ouvrir son dossier.</p>
              </div>
            )}
          </div>
        </div>
        )
      )}
    </div>
  );
}

export function RequestDetail({
  id,
  services,
  onBack,
  onChanged,
  backLabel,
}: {
  id: number;
  services: Service[];
  onBack: () => void;
  onChanged: () => void;
  backLabel?: string;
}) {
  const detail = trpc.mds.requests.detail.useQuery({ id }, { retry: false });
  const utils = trpc.useUtils();
  const [action, setAction] = useState<ArtisanAction | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<number | undefined>();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState<unknown>(null);
  const mutation = trpc.mds.requests.artisanAction.useMutation();
  const locationPush = trpc.mds.location.push.useMutation();
  const confirmCompletion = trpc.mds.requests.clientAction.useMutation();
  const [gpsRequested, setGpsRequested] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");
  const [signingClient, setSigningClient] = useState(false);
  const gpsWatch = useRef<number | null>(null);
  const lastGpsSent = useRef(0);
  const request = detail.data?.request;
  const service = services.find(item => item.id === request?.serviceId);
  async function refresh() {
    await Promise.all([
      detail.refetch(),
      utils.mds.appointments.list.invalidate(),
      utils.mds.notifications.list.invalidate(),
    ]);
    onChanged();
  }
  async function perform(input: z.infer<typeof artisanActionSchema>) {
    setError(null);
    setSuccess("");
    try {
      const parsed = artisanActionSchema.parse(input);
      await mutation.mutateAsync(parsed);
      setAction(null);
      if (input.action === "depart") setGpsRequested(true);
      setSuccess("Dossier mis à jour. Le suivi client est synchronisé.");
      await refresh();
    } catch (cause) {
      setError(cause);
      // Re-read authoritative version on rejection, notably CONFLICT or expiration.
      await refresh();
    }
  }
  async function handleClientSign(dataUrl: string) {
    if (!request) return;
    setError(null);
    setSuccess("");
    try {
      await confirmCompletion.mutateAsync({
        reference: request.reference,
        version: request.version,
        action: "confirmCompletion",
        signatureDataUrl: dataUrl,
      });
      setSuccess("Signature du client enregistrée. Les travaux sont validés.");
      await refresh();
    } catch (cause) {
      setError(cause);
      await refresh();
    }
  }
  useEffect(() => {
    if (!gpsRequested || request?.status !== "en_route") {
      if (gpsWatch.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatch.current);
        gpsWatch.current = null;
      }
      return;
    }
    if (!navigator.geolocation) {
      setGpsMessage(
        "La géolocalisation n’est pas disponible sur cet appareil."
      );
      return;
    }
    setGpsMessage("Autorisation de localisation en attente…");
    gpsWatch.current = navigator.geolocation.watchPosition(
      position => {
        setGpsMessage("Position GPS partagée pendant le trajet.");
        const now = Date.now();
        if (now - lastGpsSent.current < 10000) return;
        lastGpsSent.current = now;
        void locationPush
          .mutateAsync({
            requestId: request.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: Number.isFinite(position.coords.accuracy)
              ? position.coords.accuracy
              : null,
          })
          .catch(() =>
            setGpsMessage(
              "Réseau indisponible : nouvelle tentative automatique."
            )
          );
      },
      error => {
        setGpsMessage(
          error.code === error.PERMISSION_DENIED
            ? "Localisation refusée : le suivi continue par statuts."
            : "Position momentanément indisponible : le suivi continue par statuts."
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      if (gpsWatch.current != null) {
        navigator.geolocation.clearWatch(gpsWatch.current);
        gpsWatch.current = null;
      }
    };
  }, [gpsRequested, request?.id, request?.status]);
  if (!request)
    return (
      <section className="panel">
        <QueryState
          loading={detail.isLoading}
          error={detail.error}
          retry={detail.refetch}
        />
      </section>
    );
  const editable = editableRequestStatuses.includes(request.status);
  const quickStart = request.proposedStart ?? request.desiredStart;
  const quickPrice = proposalPrice(request, service);
  const needsAcceptedQuote = quoteRequired(request);
  const quickAccept =
    !!quickStart &&
    new Date(quickStart).getTime() > Date.now() &&
    quickPrice != null &&
    !needsAcceptedQuote;
  const canCancel =
    editable || ["confirmed", "planned", "en_route"].includes(request.status);
  const documents = detail.data?.documents ?? [];
  const hasInvoice = documents.some(document => document.kind === "invoice");
  const hasAfterPhoto = documents.some(
    document => document.kind === "photo" && document.photoStage === "after"
  );
  const hasQuote = documents.some(document => document.kind === "quote");
  const beforeCount = documents.filter(
    document => document.kind === "photo" && document.photoStage === "before"
  ).length;
  const afterCount = documents.filter(
    document => document.kind === "photo" && document.photoStage === "after"
  ).length;
  const workStatuses = [
    "in_progress",
    "completed",
    "invoiced",
    "paid",
    "closed",
  ];
  const hasArrived =
    !!detail.data?.intervention?.arrivedAt ||
    workStatuses.includes(request.status);
  const interventionSteps = [
    { label: "Arrivé", done: hasArrived },
    { label: "Travaux", done: workStatuses.includes(request.status) },
    { label: "Photos", done: hasAfterPhoto },
    {
      label: detail.data?.intervention?.clientSignedAt
        ? "Validation signée"
        : "Validation",
      done: !!detail.data?.intervention?.clientConfirmedAt,
    },
  ];
  const activeStep = interventionSteps.findIndex(step => !step.done);
  return (
    <section
      className="panel stack"
      style={{ minWidth: 0 }}
      aria-label={`Dossier ${request.reference}`}
    >
      <ActionButton
        onClick={() => {
          onBack();
          try {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch {}
        }}
        style={{
          alignSelf: "start",
          fontWeight: 600,
          fontSize: 14,
          padding: "10px 14px",
        }}
      >
        <ChevronLeft size={17} aria-hidden="true" /> {backLabel ?? "Retour à la liste des demandes"}
      </ActionButton>
      <header className="stack">
        <div
          className="row"
          style={{ justifyContent: "space-between", flexWrap: "wrap" }}
        >
          <span className="eyebrow">{request.reference}</span>
          <StatusBadge status={request.status} />
        </div>
        <h3 style={{ fontSize: 25 }}>
          {request.serviceName || "Demande à analyser"}
        </h3>
        <p className="muted">Reçue le {dateTime(request.createdAt)}</p>
      </header>
      <ErrorNotice error={error ?? detail.error} />
      {success && (
        <p className="success-message" role="status">
          {success}
        </p>
      )}
      <section className="stack">
        <h4>Le problème</h4>
        {request.problemType && <strong>{request.problemType}</strong>}
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {request.description}
        </p>
        {Object.keys(request.answers).length > 0 && (
          <dl>
            {Object.entries(request.answers).map(([question, answer]) => (
              <div key={question} style={{ marginBottom: 10 }}>
                <dt className="muted">{question}</dt>
                <dd>{answer}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section className="stack">
        <h4>Client et lieu</h4>
        <strong>{request.name}</strong>
        <p className="row">
          <MapPin size={17} aria-hidden="true" />
          {request.address}, {request.postcode} {request.city}
        </p>
        <a
          className="text-link row"
          style={{ minHeight: 44, overflowWrap: "anywhere" }}
          href={`tel:${request.phone}`}
        >
          <Phone size={17} aria-hidden="true" />
          {request.phone}
        </a>
        <a
          className="text-link row"
          style={{ minHeight: 44, overflowWrap: "anywhere" }}
          href={`mailto:${request.email}`}
        >
          <Mail size={17} aria-hidden="true" />
          {request.email}
        </a>
        {request.organizationId && (
          <p className="muted">
            Dossier rattaché à l’organisation n° {request.organizationId}
            {request.siteId ? ` · site n° ${request.siteId}` : ""}.
          </p>
        )}
      </section>
      {["confirmed", "planned", "en_route"].includes(request.status) && (
        <section className="trip-gps-readiness" aria-live="polite">
          <div>
            <strong>
              {request.status === "en_route"
                ? "Trajet déclaré — suivi GPS en préparation"
                : "Suivi GPS du trajet"}
            </strong>
            <p>
              {request.status === "en_route"
                ? gpsMessage ||
                  "Le partage GPS va démarrer après votre autorisation."
                : "Au démarrage du trajet, l’autorisation de localisation sera demandée. Le partage sera limité à cette intervention et s’arrêtera à l’arrivée."}
            </p>
          </div>
          <small>
            {request.status === "en_route"
              ? locationPush.isPending
                ? "Envoi de la position…"
                : "La carte client se met à jour pendant le trajet."
              : "La carte reste inactive avant votre départ réel."}
          </small>
        </section>
      )}
      {hasArrived && (
        <section
          className="artisan-work-panel"
          aria-label="Avancement de l’intervention"
        >
          <ol className="artisan-stepper">
            {interventionSteps.map((step, index) => (
              <li
                key={step.label}
                className={
                  step.done
                    ? "is-done"
                    : index === activeStep
                      ? "is-active"
                      : ""
                }
                aria-current={index === activeStep ? "step" : undefined}
              >
                <span aria-hidden="true">
                  {step.done ? <Check size={14} strokeWidth={3} /> : index + 1}
                </span>
                {step.label}
              </li>
            ))}
          </ol>
          <div className="artisan-photo-counters">
            <p>
              <strong>Photos avant travaux</strong>
              <span className={beforeCount ? "is-ok" : ""}>
                {beforeCount} {beforeCount ? "✓" : ""}
              </span>
            </p>
            <p>
              <strong>Photos après travaux *</strong>
              <span className={afterCount ? "is-ok" : "is-missing"}>
                {afterCount ? `${afterCount} ✓` : "0 · obligatoire"}
              </span>
            </p>
          </div>
          {!hasAfterPhoto && workStatuses.includes(request.status) && (
            <p className="artisan-photo-hint">
              Ajoutez au moins une photo après travaux dans « Documents et
              photos » ci-dessous, vérifiez l’aperçu, puis terminez
              l’intervention.
            </p>
          )}
        </section>
      )}
      <section className="stack artisan-fiche-actions" aria-label="Répondre à la demande">
        <h4 style={{ margin: 0, color: "#bc4c23", fontSize: 16 }}>Action à réaliser</h4>
        {mutation.isPending && (
          <p className="notice" role="status">
            Enregistrement de l’action en cours… Les autres actions sont
            momentanément mises en pause pour éviter un double clic.
          </p>
        )}
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {editable && (
            <>
              {needsAcceptedQuote ? (
                <ActionButton
                  className="primary"
                  disabled={mutation.isPending}
                  onClick={() => setAction("quote")}
                >
                  <FileText size={17} aria-hidden="true" />
                  Préparer le devis
                </ActionButton>
              ) : (
                <ActionButton
                  className="primary"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (quickAccept)
                      void perform({
                        id: request.id,
                        version: request.version,
                        action: "accept",
                        proposedStart: new Date(quickStart!).toISOString(),
                        priceCents: quickPrice!,
                        durationMinutes: request.durationMinutes,
                      });
                    else setAction("accept");
                  }}
                >
                  <Check size={17} aria-hidden="true" />
                  Accepter
                </ActionButton>
              )}
              <ActionButton
                disabled={mutation.isPending}
                onClick={() => setAction("refuse")}
              >
                <X size={17} aria-hidden="true" />
                Refuser
              </ActionButton>
              {!needsAcceptedQuote && (
                <ActionButton
                  disabled={mutation.isPending}
                  onClick={() => setAction("propose")}
                >
                  <CalendarDays size={17} aria-hidden="true" />
                  Autre créneau
                </ActionButton>
              )}
              {needsAcceptedQuote && (
                <small className="muted" style={{ flexBasis: "100%" }}>
                  Un devis distinct doit être accepté avant de proposer un créneau.
                </small>
              )}
            </>
          )}
          {["confirmed", "planned"].includes(request.status) && (
            <ActionButton
              className="trip-btn trip-depart"
              disabled={mutation.isPending}
              onClick={() => setAction("depart")}
            >
              <Play size={17} aria-hidden="true" />
              Démarrer le trajet
            </ActionButton>
          )}
          {request.status === "en_route" &&
            !detail.data?.intervention?.arrivedAt && (
              <ActionButton
                className="trip-btn trip-arrived"
                disabled={mutation.isPending}
                onClick={() => setAction("arrived")}
              >
                <MapPin size={17} aria-hidden="true" />
                Je suis arrivé
              </ActionButton>
            )}
          {request.status === "en_route" &&
            detail.data?.intervention?.arrivedAt && (
              <ActionButton
                className="trip-btn trip-start"
                disabled={mutation.isPending}
                onClick={() => setAction("start")}
              >
                <Play size={17} aria-hidden="true" />
                Commencer l’intervention
              </ActionButton>
            )}
          {request.status === "in_progress" && (
            <div className="stack">
              <ActionButton
                className="trip-btn trip-finish"
                disabled={mutation.isPending || !hasAfterPhoto}
                onClick={() => setAction("complete")}
              >
                <SquareCheck size={17} aria-hidden="true" />
                Terminer l’intervention
              </ActionButton>
              {!hasAfterPhoto && (
                <small className="muted">
                  Ajoutez d’abord au moins une photo après travaux. Un
                  commentaire ne suffit pas.
                </small>
              )}
            </div>
          )}
          {request.status === "completed" &&
            !detail.data?.intervention?.clientConfirmedAt && (
              <ActionButton
                className="trip-btn trip-sign"
                disabled={confirmCompletion.isPending}
                onClick={() => setSigningClient(true)}
              >
                <Pen size={17} aria-hidden="true" />
                Faire signer le client sur cet écran
              </ActionButton>
            )}
          {request.status === "completed" && hasInvoice && (
            <ActionButton
              disabled={mutation.isPending}
              onClick={() => setAction("invoice")}
            >
              Facture émise
            </ActionButton>
          )}
          {request.status === "invoiced" && (
            <ActionButton
              disabled={mutation.isPending}
              onClick={() => setAction("paid")}
            >
              Confirmer un paiement reçu
            </ActionButton>
          )}
          {request.status === "paid" && (
            <ActionButton
              disabled={mutation.isPending}
              onClick={() => setAction("close")}
            >
              Clôturer
            </ActionButton>
          )}
        </div>
        {(editable ||
          canCancel ||
          ["confirmed", "planned"].includes(request.status)) && (
          <details>
            <summary
              style={{
                minHeight: 44,
                padding: "12px 0",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Autres outils
            </summary>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {editable && (
                <>
                  <ActionButton
                    disabled={mutation.isPending}
                    onClick={() =>
                      void perform({
                        id: request.id,
                        version: request.version,
                        action: "photo",
                      })
                    }
                  >
                    Demander une photo
                  </ActionButton>
                  <ActionButton
                    disabled={mutation.isPending}
                    onClick={() => setAction("information")}
                  >
                    <MessageSquare size={17} aria-hidden="true" />
                    Précisions
                  </ActionButton>
                  <ActionButton
                    disabled={mutation.isPending}
                    onClick={() => setAction("diagnostic")}
                  >
                    Organiser un diagnostic
                  </ActionButton>
                  <ActionButton
                    disabled={mutation.isPending}
                    onClick={() => {
                      setQuoteAmount(undefined);
                      setAction("quote");
                    }}
                  >
                    <FileText size={17} aria-hidden="true" />
                    Soumettre un PDF de devis
                  </ActionButton>
                </>
              )}
              {["confirmed", "planned"].includes(request.status) && (
                <ActionButton
                  disabled={mutation.isPending}
                  onClick={() => setAction("start")}
                >
                  Commencer si déjà sur place
                </ActionButton>
              )}
              {canCancel && (
                <ActionButton
                  className="secondary danger"
                  disabled={mutation.isPending}
                  onClick={() => setAction("cancel")}
                >
                  Annuler
                </ActionButton>
              )}
            </div>
          </details>
        )}
      </section>
      {request.pricingSnapshot ? (
        <PricingSnapshotSummary snapshot={request.pricingSnapshot} />
      ) : (
        <p className="notice">
          Ancien dossier : aucun instantané des conditions et des frais au dépôt
          n’a été conservé. Le tarif du catalogue actuel ne prouve pas les
          anciennes conditions. Le parcours historique reste disponible ; faites
          accepter un vrai devis pour clarifier ou modifier le périmètre.
        </p>
      )}
      <section className="notice stack">
        <h4>Créneau et proposition</h4>
        <p className="row">
          <CalendarDays size={17} aria-hidden="true" />
          Souhait client : {dateTime(request.desiredStart)}
        </p>
        {request.proposedStart && (
          <p>Proposé par MDS : {dateTime(request.proposedStart)}</p>
        )}
        {!!request.alternatives?.length && (
          <details>
            <summary>
              Autres créneaux proposés ({request.alternatives.length})
            </summary>
            <ul>
              {request.alternatives.map(value => (
                <li key={value.id}>{dateTime(value.startAt)}</li>
              ))}
            </ul>
          </details>
        )}
        <p>
          Prix proposé : {money(request.proposedPriceCents)} · Durée :{" "}
          {request.durationMinutes} min
        </p>
        {request.proposalMessage && (
          <p style={{ whiteSpace: "pre-wrap" }}>{request.proposalMessage}</p>
        )}
        {request.expiresAt && (
          <p className="muted">
            Validité de la proposition : {dateTime(request.expiresAt)}
          </p>
        )}
        {request.quoteStatus !== "none" && (
          <p>
            Devis :{" "}
            {
              {
                pending: "en attente d’accord client",
                accepted: "accepté par le client",
                refused: "refusé par le client",
              }[request.quoteStatus]
            }
          </p>
        )}
        {detail.data?.appointment &&
        detail.data.appointment.status !== "cancelled" ? (
          <p className="success-message">
            Rendez-vous confirmé : {dateTime(detail.data.appointment.startAt)} →{" "}
            {dateTime(detail.data.appointment.endAt)}
          </p>
        ) : (
          <p className="muted">
            Aucun rendez-vous définitif : les deux validations sont nécessaires.
          </p>
        )}
      </section>
      {detail.data?.intervention?.clientSignedAt ? (
        <section className="stack">
          <h4>Signature du client</h4>
          <p className="success-message" role="status">
            Signée le {dateTime(detail.data.intervention.clientSignedAt)}.
            {detail.data.intervention.clientConfirmationMessage &&
              ` « ${detail.data.intervention.clientConfirmationMessage} »`}
          </p>
          {detail.data.intervention.clientSignatureDocumentId && (
            <SignatureThumb
              id={detail.data.intervention.clientSignatureDocumentId}
              reference={request.reference}
            />
          )}
        </section>
      ) : detail.data?.intervention?.clientConfirmedAt ? (
        <section className="stack">
          <h4>Validation client</h4>
          <p className="success-message" role="status">
            Confirmée le {dateTime(detail.data.intervention.clientConfirmedAt)}.
            {detail.data.intervention.clientConfirmationMessage &&
              ` « ${detail.data.intervention.clientConfirmationMessage} »`}
          </p>
        </section>
      ) : null}
      {request.status === "completed" &&
        !detail.data?.intervention?.clientConfirmedAt && (
          <details
            open
            className="panel stack"
            style={{ background: "#fffaf7", borderColor: "#e4cbbd" }}
          >
            <summary
              style={{
                minHeight: 36,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              <Pen size={15} color="#bc4c23" aria-hidden="true" /> Faire signer
              le client sur cet écran
            </summary>
            <p className="small-text muted" style={{ marginTop: 8 }}>
              Tendez cet écran au client pour qu’il confirme et signe la fin des
              travaux avec son doigt.
            </p>
            <SignaturePad
              disabled={confirmCompletion.isPending}
              error={confirmCompletion.error}
              onSign={handleClientSign}
            />
          </details>
        )}
      {detail.data && (
        <PrivateOperations detail={detail.data} onChanged={refresh} />
      )}
      {editable && (
        <PrivateQuoteBuilder
          request={request}
          latestQuoteDocumentId={
            documents.filter(doc => doc.kind === "quote").at(-1)?.id
          }
          onChanged={refresh}
          onSubmitQuote={amount => {
            setQuoteAmount(amount);
            setAction("quote");
          }}
        />
      )}
      <PaymentTools
        requestId={request.id}
        version={request.version}
        reference={request.reference}
      />

      <details className="stack">
        <summary
          style={{
            cursor: "pointer",
            minHeight: 44,
            padding: "12px 0",
            fontWeight: 700,
          }}
        >
          Documents et photos ({documents.length})
        </summary>
        <DocumentList documents={documents} reference={request.reference} />
        <div className="stack" style={{ marginTop: 20 }}>
          <h4>Déposer un devis ou une facture</h4>
          <RequestUpload
            reference={request.reference}
            onUploaded={() => void refresh()}
          />
        </div>
      </details>
      <details>
        <summary
          style={{
            cursor: "pointer",
            minHeight: 44,
            padding: "12px 0",
            fontWeight: 700,
          }}
        >
          Historique réel du dossier
        </summary>
        {detail.data?.events.length === 0 ? (
          <div className="empty">Aucun événement enregistré.</div>
        ) : (
          <ol className="data-list" style={{ listStyle: "none", padding: 0 }}>
            {detail.data?.events.map(event => (
              <li key={event.id} className="data-row">
                <p className="row">
                  <Clock size={16} aria-hidden="true" />
                  <strong>
                    {statusLabels[event.status as keyof typeof statusLabels] ??
                      event.status}
                  </strong>
                </p>
                <p>{event.message}</p>
                <small className="muted">
                  {dateTime(event.createdAt)} ·{" "}
                  {event.actorType === "artisan"
                    ? "MDS"
                    : event.actorType === "client"
                      ? "Client"
                      : "Système"}
                </small>
              </li>
            ))}
          </ol>
        )}
      </details>
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <ActionButton
          className="secondary"
          onClick={() => {
            onBack();
            try {
              window.scrollTo({ top: 0, behavior: "smooth" });
            } catch {}
          }}
        >
          <ChevronLeft size={17} aria-hidden="true" /> {backLabel ?? "Retour à la liste des demandes"}
        </ActionButton>
      </div>
      {request.status === "completed" && (
        <ReviewForm
          requestId={request.id}
          existing={
            !!detail.data?.reviews.some(
              review => review.authorType === "artisan"
            )
          }
          onSubmitted={() => void refresh()}
        />
      )}
      {action && (
        <ActionForm
          key={`${request.id}-${request.version}-${action}`}
          action={action}
          request={request}
          service={service}
          pending={mutation.isPending}
          hasQuote={hasQuote}
          initialQuotePrice={quoteAmount}
          onDocumentUploaded={() => void refresh()}
          error={error}
          onClose={() => {
            setAction(null);
            setError(null);
          }}
          onSubmit={perform}
        />
      )}
      {signingClient && request && (
        <PrivateModal
          title="Réception de fin de chantier"
          description="Tendez cet écran au client pour qu’il confirme et signe la fin des travaux."
          onClose={() => setSigningClient(false)}
        >
          <div className="stack" style={{ gap: 14 }}>
            <div
              className="stack"
              style={{
                padding: 12,
                background: "#f8f7f5",
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <strong>
                {request.serviceName || "Demande libre"} — {request.reference}
              </strong>
              <span>
                {request.name} · {request.address}, {request.city}
              </span>
              <span className="muted">
                « Je certifie que les travaux ont été réalisés conformément à ma
                demande. »
              </span>
            </div>
            <SignaturePad
              disabled={confirmCompletion.isPending}
              error={confirmCompletion.error}
              onSign={async dataUrl => {
                await handleClientSign(dataUrl);
                setSigningClient(false);
              }}
            />
          </div>
        </PrivateModal>
      )}
    </section>
  );
}

function ActionForm({
  action,
  request,
  service,
  pending,
  error,
  hasQuote,
  initialQuotePrice,
  onDocumentUploaded,
  onClose,
  onSubmit,
}: {
  action: ArtisanAction;
  request: RequestRecord;
  service?: Service;
  pending: boolean;
  error: unknown;
  hasQuote: boolean;
  initialQuotePrice?: number;
  onDocumentUploaded: () => void;
  onClose: () => void;
  onSubmit: (input: z.infer<typeof artisanActionSchema>) => Promise<void>;
}) {
  const [openedVersion] = useState(request.version);
  const [start, setStart] = useState(
    dateInput(request.proposedStart ?? request.desiredStart)
  );
  const [alternatives, setAlternatives] = useState<string[]>(
    request.alternatives?.map(value => dateInput(value.startAt)) || []
  );
  const [price, setPrice] = useState(() =>
    euroInput(
      action === "quote"
        ? (initialQuotePrice ?? request.proposedPriceCents)
        : proposalPrice(request, service)
    )
  );
  const [duration, setDuration] = useState(
    String(
      request.durationMinutes ||
        request.pricingSnapshot?.durationMinutes ||
        service?.durationMinutes ||
        15
    )
  );
  const [message, setMessage] = useState(
    action === "diagnostic"
      ? "Un diagnostic doit être organisé avant de proposer les travaux. Pouvez-vous préciser les symptômes et vos disponibilités pour en discuter ?"
      : ""
  );
  const proposal = ["accept", "propose", "quote"].includes(action);
  const priceLocked =
    action !== "quote" &&
    (request.pricingSnapshot != null || request.quoteStatus === "accepted");
  const authoritativePrice = proposalPrice(request, service);
  const directProposalBlocked =
    ["accept", "propose"].includes(action) && quoteRequired(request);
  const [localError, setLocalError] = useState<unknown>(null);
  async function submit() {
    setLocalError(null);
    try {
      if (directProposalBlocked)
        throw new Error(
          "Un devis accepté est nécessaire avant cette action. Utilisez l’action Devis."
        );
      const proposedPrice = proposal
        ? priceLocked
          ? authoritativePrice
          : parseEuroCents(price, "Prix proposé")
        : null;
      if (proposal && proposedPrice == null)
        throw new Error(
          "Un prix défini est nécessaire. Déposez un devis si le total ne peut pas être calculé."
        );
      await onSubmit({
        id: request.id,
        version: openedVersion,
        action,
        message,
        ...(proposal
          ? {
              ...(start
                ? { proposedStart: new Date(start).toISOString() }
                : {}),
              alternativeStarts: alternatives.map(value =>
                new Date(value).toISOString()
              ),
              ...(proposedPrice != null ? { priceCents: proposedPrice } : {}),
              durationMinutes: Number(duration),
            }
          : {}),
      });
    } catch (cause) {
      setLocalError(cause);
    }
  }
  return (
    <PrivateModal
      title={actionLabels[action]}
      description={
        proposal
          ? "La proposition doit encore être validée par le client. Un devis nécessite son accord distinct."
          : "Cette action sera enregistrée dans l’historique du dossier."
      }
      onClose={onClose}
    >
      {action === "quote" && (
        <section className="stack">
          <h3>Le document de devis</h3>
          <p className="muted">
            Déposez un vrai PDF avant de soumettre la proposition. Un document
            déjà proposé ne peut pas servir de nouveau devis.
          </p>
          {hasQuote && (
            <p className="notice">
              Un devis est présent dans le dossier. Le serveur vérifie qu’il n’a
              pas déjà été proposé.
            </p>
          )}
          <UploadDocument
            reference={request.reference}
            kind="quote"
            onUploaded={onDocumentUploaded}
          />
        </section>
      )}
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        {proposal && (
          <>
            <Field
              label="Créneau proposé"
              hint="Heure locale de votre navigateur ; le suivi affiche l’heure de Paris."
            >
              <input
                type="datetime-local"
                value={start}
                onChange={e => setStart(e.target.value)}
                required
              />
            </Field>
            {alternatives.map((value, index) => (
              <Field key={index} label={`Autre créneau ${index + 1}`}>
                <div className="row">
                  <input
                    type="datetime-local"
                    required
                    value={value}
                    onChange={e =>
                      setAlternatives(
                        alternatives.map((row, n) =>
                          n === index ? e.target.value : row
                        )
                      )
                    }
                  />
                  <ActionButton
                    onClick={() =>
                      setAlternatives(
                        alternatives.filter((_, n) => n !== index)
                      )
                    }
                  >
                    Retirer
                  </ActionButton>
                </div>
              </Field>
            ))}
            <ActionButton
              disabled={alternatives.length >= 5}
              onClick={() => setAlternatives([...alternatives, ""])}
            >
              Ajouter un autre créneau
            </ActionButton>
            <div className="form-grid">
              <Field
                label={
                  priceLocked
                    ? "Prix conservé du dossier (€)"
                    : action === "quote"
                      ? "Montant total du devis PDF (€)"
                      : "Prix proposé (€)"
                }
                hint={
                  priceLocked
                    ? "Non modifiable : toute nouvelle portée ou montant nécessite un nouveau devis PDF accepté."
                    : "Virgule ou point, deux décimales maximum. Le montant du devis doit correspondre au PDF."
                }
              >
                <input
                  type="text"
                  inputMode="decimal"
                  maxLength={20}
                  required
                  readOnly={priceLocked}
                  value={priceLocked ? euroInput(authoritativePrice) : price}
                  onChange={e => setPrice(e.target.value)}
                />
              </Field>
              <Field label="Durée (minutes)">
                <input
                  type="number"
                  min="15"
                  max="1440"
                  step="1"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  required
                />
              </Field>
            </div>
          </>
        )}
        {action === "depart" && (
          <p className="notice">
            Je confirme que je pars maintenant vers ce rendez-vous. Le client
            verra « Artisan en route » après cette déclaration.
          </p>
        )}
        {action === "arrived" && (
          <p className="notice">
            Je confirme être arrivé à l’adresse. Le client recevra
            automatiquement une notification et le partage GPS s’arrêtera. Vous
            pouvez ajouter un message ci-dessous.
          </p>
        )}
        {action === "diagnostic" && (
          <p className="notice">
            Cette demande d’informations ne réserve pas de diagnostic et
            n’annonce aucun tarif.
          </p>
        )}
        {action === "paid" && (
          <p className="notice">
            Confirmation manuelle d’un paiement réellement reçu, pas d’une
            tentative ou d’une simulation en mode test. Vérifiez le relevé ou le
            justificatif et renseignez le mode, la date ou la référence.
          </p>
        )}
        {action === "invoice" && (
          <p className="notice">
            Le serveur reprend le montant applicable au dossier. Cette action ne
            permet pas de saisir un supplément.
          </p>
        )}
        <Field
          label={
            action === "information"
              ? "Précisions demandées"
              : action === "paid"
                ? "Vérification du paiement reçu (mode, date ou référence)"
                : "Message au client"
          }
        >
          <textarea
            rows={4}
            maxLength={3000}
            value={message}
            onChange={e => setMessage(e.target.value)}
            required={["information", "refuse", "cancel", "paid"].includes(
              action
            )}
          />
        </Field>
        <ErrorNotice error={localError ?? error} />
        <div className="row" style={{ flexWrap: "wrap" }}>
          <ActionButton
            type="submit"
            className={
              action === "cancel" || action === "refuse" ? "dark" : "primary"
            }
            disabled={
              pending ||
              directProposalBlocked ||
              (action === "quote" && !hasQuote)
            }
          >
            {pending ? "Enregistrement…" : "Confirmer"}
          </ActionButton>
          <ActionButton disabled={pending} onClick={onClose}>
            Retour
          </ActionButton>
        </div>
      </form>
    </PrivateModal>
  );
}
function RequestUpload({
  reference,
  onUploaded,
}: {
  reference: string;
  onUploaded: () => void;
}) {
  const [kind, setKind] = useState<"quote" | "invoice">("quote");
  return (
    <div className="stack">
      <Field label="Type de document">
        <select
          value={kind}
          onChange={e => setKind(e.target.value as "quote" | "invoice")}
        >
          <option value="quote">Devis</option>
          <option value="invoice">Facture</option>
        </select>
      </Field>
      <UploadDocument
        reference={reference}
        kind={kind}
        onUploaded={onUploaded}
      />
    </div>
  );
}
function ReviewForm({
  requestId,
  existing,
  onSubmitted,
}: {
  requestId: number;
  existing: boolean;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const review = trpc.mds.reviews.submit.useMutation({
    onSuccess: onSubmitted,
  });
  if (existing || review.isSuccess)
    return (
      <p className="notice" role="status">
        Votre évaluation privée a été enregistrée. Elle n’est pas publiée
        automatiquement.
      </p>
    );
  return (
    <details>
      <summary
        style={{
          minHeight: 44,
          padding: "12px 0",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Évaluer cette intervention terminée
      </summary>
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          review.mutate({
            requestId,
            rating: Number(rating),
            comment: comment.trim() || undefined,
          });
        }}
      >
        <p className="muted">
          Évaluation artisan authentifiée, privée et soumise à modération.
        </p>
        <Field label="Note">
          <select
            required
            value={rating}
            onChange={e => setRating(e.target.value)}
          >
            <option value="">Choisir une note</option>
            {[1, 2, 3, 4, 5].map(value => (
              <option key={value} value={value}>
                {value} sur 5
              </option>
            ))}
          </select>
        </Field>
        <Field label="Commentaire (facultatif)">
          <textarea
            rows={3}
            value={comment}
            maxLength={2000}
            onChange={e => setComment(e.target.value)}
          />
        </Field>
        <ErrorNotice error={review.error} />
        <ActionButton type="submit" disabled={review.isPending}>
          Enregistrer l’évaluation
        </ActionButton>
      </form>
    </details>
  );
}
