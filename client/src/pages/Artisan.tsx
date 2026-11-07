import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  ExternalLink,
  HelpCircle,
  LockKeyhole,
  Settings2,
  User,
  Users,
  Wrench,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { dateTime, money } from "@shared/mds";
import {
  ActionButton,
  ErrorNotice,
  Field,
  LoginButton,
  QueryState,
  StatusBadge,
} from "@/components/mds/private-common";
import {
  ArtisanRequests,
  RequestDetail,
} from "@/components/mds/private-artisan-requests";
import { ArtisanSettings } from "@/components/mds/private-artisan-settings";
import { ArtisanCalendar } from "@/components/mds/private-calendar";
import { AutomationSettings } from "@/components/mds/private-automation";
import { ArtisanLocationsMap } from "@/components/mds/ArtisanLocationsMap";
import {
  activeRequestStatuses,
  dayKey,
  type Appointment,
  type RequestRecord,
  type Service,
} from "@/components/mds/private-types";
import "@/components/mds/private.css";

const navigation = [
  { id: "requests", name: "Demandes", icon: ClipboardList },
  { id: "planning", name: "Planning", icon: CalendarDays },
  { id: "interventions", name: "Interventions", icon: Wrench },
  { id: "settlements", name: "Mes règlements", icon: WalletCards },
  { id: "activity", name: "Activité", icon: Activity },
] as const;
type Tab = (typeof navigation)[number]["id"];

export default function Artisan() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <main className="page-shell">
        <QueryState loading />
      </main>
    );
  if (auth.error)
    return (
      <main className="page-shell">
        <QueryState error={auth.error} retry={auth.refresh} />
      </main>
    );
  if (!auth.user)
    return (
      <main className="page-shell">
        <section
          className="panel stack"
          style={{ maxWidth: 640, margin: "48px auto" }}
        >
          <span className="eyebrow">Accès réservé</span>
          <LockKeyhole size={30} aria-hidden="true" />
          <h1 className="page-title">Atelier de l’artisan</h1>
          <p className="muted">
            Cet espace est strictement réservé au propriétaire de MULTISERVICES
            MDS.
          </p>
          <LoginButton />
          <p
            className="muted small-text"
            style={{ textAlign: "center", margin: 0 }}
          >
            Vous êtes client ? <Link href="/demande">Demander un devis</Link> ·{" "}
            <Link href="/suivi">Suivre vos demandes</Link> ·{" "}
            <Link href="/professionnels">Espace professionnel</Link>
          </p>
          <Link
            className="text-link"
            href="/"
            style={{ alignSelf: "center", marginTop: 8 }}
          >
            Revenir à l’accueil
          </Link>
        </section>
      </main>
    );
  if (auth.user.role !== "admin")
    return <ArtisanAccessDenied name={auth.user.name} />;
  return <ArtisanWorkspace />;
}
function ArtisanAccessDenied({ name }: { name: string | null }) {
  return (
    <main className="page-shell">
      <section
        className="panel stack"
        style={{ maxWidth: 640, margin: "48px auto" }}
      >
        <span className="eyebrow">Accès réservé</span>
        <h1 className="page-title">Espace réservé à l’équipe MDS</h1>
        <p>
          {name ? `Bonjour ${name}. ` : ""}Votre compte client ne donne pas
          accès aux demandes, au planning ou aux règlements de l’artisan.
        </p>
        <p className="muted">
          Vous restez dans votre propre espace : vos demandes, votre suivi et
          vos contrats professionnels. Aucun code d’activation n’est demandé aux
          clients.
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <Link href="/demande" className="btn primary">
            Espace particulier →
          </Link>
          <Link href="/professionnels" className="btn secondary">
            Espace professionnel →
          </Link>
        </div>
        <Link className="text-link" href="/">
          Revenir à l’accueil
        </Link>
      </section>
    </main>
  );
}
function ArtisanWorkspace() {
  const [tab, setTab] = useState<Tab>("requests");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [urgentNotice, setUrgentNotice] = useState<RequestRecord | null>(null);
  const [urgentMapOnly, setUrgentMapOnly] = useState(false);
  const knownUrgentIds = useRef<Set<number> | null>(null);
  const requestsQuery = trpc.mds.requests.list.useQuery(undefined, {
    retry: false,
    refetchInterval: 10_000,
  });
  const waitlistQuery = trpc.mds.requests.waitlist.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const catalogQuery = trpc.mds.catalog.list.useQuery(
    { includeInactive: true },
    { retry: false }
  );
  const appointmentsQuery = trpc.mds.appointments.list.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const utils = trpc.useUtils();
  const requests = requestsQuery.data ?? [],
    services = catalogQuery.data ?? [],
    appointments = appointmentsQuery.data ?? [];
  const pending = requests.filter(request =>
    activeRequestStatuses.includes(request.status)
  );
  useEffect(() => {
    if (!requestsQuery.data) return;
    const urgent = requestsQuery.data.filter(
      request =>
        request.answers?.__urgency === "urgent" &&
        activeRequestStatuses.includes(request.status)
    );
    const currentIds = new Set(urgent.map(request => request.id));
    if (knownUrgentIds.current === null) {
      knownUrgentIds.current = currentIds;
      return;
    }
    const newlyUrgent = urgent.find(
      request => !knownUrgentIds.current?.has(request.id)
    );
    if (newlyUrgent) {
      setUrgentNotice(newlyUrgent);
    }
    knownUrgentIds.current = currentIds;
  }, [requestsQuery.data]);
  const nextRequest = [...pending].sort((a, b) => {
    const aUrgent = a.answers?.__urgency === "urgent" ? 0 : 1;
    const bUrgent = b.answers?.__urgency === "urgent" ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    return (
      new Date(a.expiresAt ?? a.createdAt).getTime() -
      new Date(b.expiresAt ?? b.createdAt).getTime()
    );
  })[0];
  const todayAppointments = appointments.filter(
    a => a.status !== "cancelled" && dayKey(a.startAt) === dayKey(new Date())
  );
  const tabTitle: Record<Tab, string> = {
    requests: "Demandes",
    planning: "Planning",
    interventions: "Interventions",
    settlements: "Mes règlements",
    activity: "Activité",
  };
  const openRequest = (id: number) => {
    setSelectedId(id);
    setTab("requests");
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  };
  const refreshRequests = () => {
    void requestsQuery.refetch();
    void waitlistQuery.refetch();
    void appointmentsQuery.refetch();
    void utils.mds.calendar.get.invalidate();
  };
  return (
    <main
      className="page-shell private-workspace"
      style={{ paddingTop: 24, paddingBottom: 64 }}
    >
      <header className="artisan-ws-head">
        <div>
          <span className="eyebrow">Espace artisan privé</span>
          <h1 className="page-title artisan-ws-title">
            {tabTitle[tab]}
            {tab === "requests" && pending.length > 0 && (
              <span className="artisan-pending-chip">
                {pending.length} à traiter
              </span>
            )}
          </h1>
        </div>
        <div className="artisan-ws-meta">
          <Link href="/" className="text-link" aria-label="Voir le site public">
            Voir le site public →
          </Link>
          <button
            type="button"
            className="text-link"
            onClick={refreshRequests}
            disabled={requestsQuery.isFetching}
          >
            {requestsQuery.isFetching ? "Actualisation…" : "Actualiser"}
          </button>
          {todayAppointments.length > 0 && (
            <button
              type="button"
              className="text-link"
              onClick={() => setTab("planning")}
            >
              {todayAppointments.length} rendez-vous aujourd’hui
            </button>
          )}
        </div>
      </header>
      <nav className="artisan-tabs" aria-label="Espace artisan">
        {navigation.map(item => (
          <button
            key={item.id}
            type="button"
            className={`artisan-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => {
              setTab(item.id);
              setSelectedId(null);
            }}
            aria-current={tab === item.id ? "page" : undefined}
          >
            <item.icon size={16} aria-hidden="true" />
            {item.name}
            {item.id === "requests" && pending.length > 0 && (
              <span className="artisan-tab-badge">{pending.length}</span>
            )}
          </button>
        ))}
      </nav>
      {tab === "requests" && nextRequest && (
        <section
          className="artisan-next-action"
          aria-labelledby="next-action-title"
        >
          <div className="artisan-next-action-icon" aria-hidden="true">
            {nextRequest.answers?.__urgency === "urgent" ? (
              <AlertTriangle size={22} />
            ) : (
              <Clock size={22} />
            )}
          </div>
          <div className="artisan-next-action-copy">
            <span className="eyebrow">Prochaine action</span>
            <h2 id="next-action-title">
              {nextRequest.answers?.__urgency === "urgent"
                ? "Traiter cette demande urgente"
                : "Traiter la prochaine demande"}
            </h2>
            <p>
              {nextRequest.serviceName || "Demande libre"} · {nextRequest.name}{" "}
              · {nextRequest.city || "Adresse à vérifier"}
            </p>
          </div>
          <button
            type="button"
            className="btn primary artisan-next-action-button"
            onClick={() => openRequest(nextRequest.id)}
          >
            Ouvrir le dossier <ChevronRight size={18} aria-hidden="true" />
          </button>
        </section>
      )}
      {urgentNotice && (
        <section
          className="artisan-live-alert"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <strong>Nouvelle demande urgente</strong>
            <span>
              {urgentNotice.serviceName || "Demande libre"} ·{" "}
              {urgentNotice.name}
            </span>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              openRequest(urgentNotice.id);
              setUrgentNotice(null);
            }}
          >
            Ouvrir
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setUrgentMapOnly(true);
              setTab("planning");
              setUrgentNotice(null);
            }}
          >
            Voir sur la carte
          </button>
          <button
            type="button"
            className="artisan-live-alert-close"
            aria-label="Fermer l’alerte de demande urgente"
            onClick={() => setUrgentNotice(null)}
          >
            <XCircle size={20} aria-hidden="true" />
          </button>
        </section>
      )}
      <div className="stack" style={{ minWidth: 0 }}>
        {tab === "requests" && (
          <>
            <div className="artisan-requests-toolbar">
              <div
                className="artisan-chip-group"
                role="radiogroup"
                aria-label="Filtrer les demandes"
              >
                <button
                  type="button"
                  className={`artisan-chip ${!showHistory ? "active" : ""}`}
                  onClick={() => setShowHistory(false)}
                  aria-pressed={!showHistory}
                >
                  À traiter ({pending.length})
                </button>
                <button
                  type="button"
                  className={`artisan-chip ${showHistory ? "active" : ""}`}
                  onClick={() => setShowHistory(true)}
                  aria-pressed={showHistory}
                >
                  Toutes ({requests.length})
                </button>
              </div>
            </div>
            {waitlistQuery.data && waitlistQuery.data.length > 0 && (
              <section
                className="panel artisan-waitlist-panel"
                aria-labelledby="waitlist-title"
              >
                <div
                  className="row"
                  style={{ justifyContent: "space-between", gap: 12 }}
                >
                  <div>
                    <span className="eyebrow">À recontacter</span>
                    <h2 id="waitlist-title" style={{ margin: "4px 0 0" }}>
                      Liste d’attente ({waitlistQuery.data.length})
                    </h2>
                  </div>
                  <Clock size={22} aria-hidden="true" />
                </div>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Ces clients n’ont pas de rendez-vous confirmé. Proposez
                  uniquement un créneau réellement libre.
                </p>
                <div className="stack" style={{ marginTop: 12 }}>
                  {waitlistQuery.data.map(entry => (
                    <button
                      key={entry.id}
                      type="button"
                      className="data-row"
                      onClick={() => openRequest(entry.requestId)}
                      style={{ textAlign: "left", width: "100%" }}
                    >
                      <strong>{entry.name}</strong>
                      <span>
                        {entry.serviceName || "Demande libre"} · {entry.city}
                      </span>
                      <small>
                        {entry.reference} · {dateTime(entry.createdAt)}
                      </small>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <ArtisanRequests
              requests={requests.filter(
                request =>
                  showHistory ||
                  activeRequestStatuses.includes(request.status) ||
                  request.id === selectedId
              )}
              services={services}
              selectedId={selectedId}
              onSelect={setSelectedId}
              loading={requestsQuery.isLoading}
              error={requestsQuery.error}
              retry={requestsQuery.refetch}
              onChanged={refreshRequests}
            />
            <details className="panel">
              <summary
                className="row"
                style={{ minHeight: 44, cursor: "pointer" }}
              >
                <Bell size={18} aria-hidden="true" /> Notifications
              </summary>
              <Notifications onOpen={openRequest} />
            </details>
          </>
        )}
        {tab === "planning" && (
          <>
            <ArtisanLocationsMap
              requests={requests}
              onOpen={openRequest}
              focusUrgent={urgentMapOnly}
            />
            <ArtisanCalendar onOpen={openRequest} />
            <details className="panel">
              <summary
                className="row"
                style={{ minHeight: 44, cursor: "pointer" }}
              >
                <Settings2 size={18} aria-hidden="true" /> Paramètres MDS
              </summary>
              <div className="stack" style={{ paddingTop: 20 }}>
                <ArtisanSettings
                  services={services}
                  catalogLoading={catalogQuery.isLoading}
                  catalogError={catalogQuery.error}
                  retryCatalog={catalogQuery.refetch}
                  onCatalogChanged={() => void catalogQuery.refetch()}
                />
                <AutomationSettings />
              </div>
            </details>
          </>
        )}
        {tab === "interventions" && (
          <Interventions
            requests={requests}
            services={services}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={requestsQuery.isLoading}
            error={requestsQuery.error}
            retry={requestsQuery.refetch}
            onChanged={refreshRequests}
          />
        )}
        {tab === "settlements" && <Settlements />}
        {tab === "activity" && (
          <AdminActivity
            onSelectRequest={openRequest}
            onGoSettings={() => {
              setTab("planning");
            }}
          />
        )}
      </div>
      <nav className="artisan-mobile-bar" aria-label="Navigation artisan">
        {navigation.map(item => (
          <button
            key={item.id}
            type="button"
            className={`artisan-mobile-btn ${tab === item.id ? "active" : ""}`}
            onClick={() => {
              setTab(item.id);
              setSelectedId(null);
            }}
            aria-current={tab === item.id ? "page" : undefined}
          >
            <item.icon size={20} aria-hidden="true" />
            <span>{item.name}</span>
            {item.id === "requests" && pending.length > 0 && (
              <span className="artisan-mobile-badge">{pending.length}</span>
            )}
          </button>
        ))}
      </nav>
    </main>
  );
}

function Settlements() {
  const query = trpc.mds.payments.settlements.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const labels = {
    pending_validation: "En attente de validation client",
    pending_transfer: "En attente de transfert",
    transferred: "Transféré",
    blocked: "Bloqué pour réclamation",
  } as const;
  return (
    <section className="stack">
      <div className="section-heading">
        <h2>Mes règlements</h2>
        <p className="muted">
          Les montants proviennent uniquement des paiements rapprochés. Aucun
          virement n’est déclaré avant la validation du client.
        </p>
      </div>
      {query.isLoading && <QueryState loading />}
      {query.error && <QueryState error={query.error} retry={query.refetch} />}
      {!query.isLoading && !query.error && query.data?.length === 0 && (
        <section className="panel">
          <p>
            Aucun paiement rapproché n’est encore associé à une intervention.
          </p>
        </section>
      )}
      {query.data?.map(row => (
        <article className="panel stack" key={row.id}>
          <div
            className="row"
            style={{ justifyContent: "space-between", flexWrap: "wrap" }}
          >
            <div>
              <strong>{row.serviceName || "Intervention MDS"}</strong>
              <p className="muted small-text">
                Dossier {row.reference} · {dateTime(row.paidAt)}
              </p>
            </div>
            <strong>
              {row.amountCents == null
                ? "Montant à vérifier"
                : money(row.amountCents)}
            </strong>
          </div>
          <span className="badge">
            {labels[row.status as keyof typeof labels] ?? row.status}
          </span>
          {row.mode === "test" && (
            <small className="muted">
              Environnement de test — aucun virement réel.
            </small>
          )}
          {!row.transferEnabled && (
            <small className="muted">
              Le transfert réel sera activé uniquement après validation du
              montage de paiement MDS.
            </small>
          )}
        </article>
      ))}
    </section>
  );
}

const runningStates: RequestRecord["status"][] = [
  "confirmed",
  "planned",
  "en_route",
  "in_progress",
];
const completedStates: RequestRecord["status"][] = [
  "completed",
  "invoiced",
  "paid",
  "closed",
];
function Interventions({
  requests,
  services,
  selectedId,
  onSelect,
  loading,
  error,
  retry,
  onChanged,
}: {
  requests: RequestRecord[];
  services: Service[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  loading: boolean;
  error: unknown;
  retry: () => unknown;
  onChanged: () => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const select = (id: number | null) => {
    onSelect(id);
    if (id !== null) {
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {}
    }
  };
  const visible = requests
    .filter(r =>
      (showCompleted ? completedStates : runningStates).includes(r.status)
    )
    .sort(
      (a, b) =>
        +new Date(a.proposedStart ?? a.createdAt) -
        +new Date(b.proposedStart ?? b.createdAt)
    );
  return (
    <section className="stack">
      <div className="section-heading">
        <h2>Interventions</h2>
      </div>
      <div className="row" role="group" aria-label="Filtrer les interventions">
        <ActionButton
          aria-pressed={!showCompleted}
          className={!showCompleted ? "primary" : "secondary"}
          onClick={() => setShowCompleted(false)}
        >
          À réaliser / en cours
        </ActionButton>
        <ActionButton
          aria-pressed={showCompleted}
          className={showCompleted ? "primary" : "secondary"}
          onClick={() => setShowCompleted(true)}
        >
          Terminées
        </ActionButton>
      </div>
      <QueryState loading={loading} error={error} retry={retry} />
      {!loading && !error && (
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
            {!visible.length && (
              <p className="muted">
                Aucune intervention {showCompleted ? "terminée" : "à réaliser"}.
              </p>
            )}
            {visible.map(request => (
              <button
                type="button"
                key={request.id}
                className="data-row"
                onClick={() => select(request.id)}
                aria-pressed={selectedId === request.id}
                style={{
                  width: "100%",
                  minHeight: 72,
                  textAlign: "left",
                  border: 0,
                  background:
                    selectedId === request.id ? "#fff3ed" : "transparent",
                  padding: 12,
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
                    <strong>{request.name}</strong>
                    <p>
                      {request.serviceName || "Demande libre"} · {request.city}
                    </p>
                    <StatusBadge status={request.status} />
                    {request.proposedStart && (
                      <p className="muted">{dateTime(request.proposedStart)}</p>
                    )}
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
            ))}
          </div>
          <div
            className={`artisan-detail-panel${
              !selectedId ? " artisan-detail-panel--hidden-mobile" : ""
            }`}
            style={{ minWidth: 0 }}
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
              <div className="panel empty">Choisissez une intervention.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
function Notifications({ onOpen }: { onOpen: (id: number) => void }) {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const notifications = trpc.mds.notifications.list.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const read = trpc.mds.notifications.read.useMutation({
    onSuccess: () => void notifications.refetch(),
  });
  const allNotifications = notifications.data ?? [];
  const unreadCount = allNotifications.filter(item => !item.readAt).length;
  const visibleNotifications = allNotifications
    .filter(item => !onlyUnread || !item.readAt)
    .slice(0, visibleCount);
  return (
    <div className="stack" style={{ paddingTop: 16 }}>
      <div
        className="row"
        style={{ justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <p className="muted">
          {unreadCount} notification{unreadCount !== 1 ? "s" : ""} non lue
          {unreadCount !== 1 ? "s" : ""}
        </p>
        <ActionButton onClick={() => setOnlyUnread(value => !value)}>
          {onlyUnread ? "Voir toutes" : "Voir les non lues"}
        </ActionButton>
      </div>
      <QueryState
        loading={notifications.isLoading}
        error={notifications.error}
        retry={notifications.refetch}
        empty={notifications.data?.length === 0}
        emptyText="Aucune notification."
      />
      <ErrorNotice error={read.error} />
      {visibleNotifications.map(notification => (
        <div className="data-row stack" key={notification.id}>
          <div
            className="row"
            style={{ justifyContent: "space-between", flexWrap: "wrap" }}
          >
            <strong>{notification.title}</strong>
            {!notification.readAt && <span className="badge">Non lue</span>}
          </div>
          <p>{notification.message}</p>
          <small className="muted">{dateTime(notification.createdAt)}</small>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {notification.requestId && (
              <ActionButton onClick={() => onOpen(notification.requestId!)}>
                Ouvrir le dossier
              </ActionButton>
            )}
            {!notification.readAt && (
              <ActionButton
                disabled={read.isPending}
                onClick={() => read.mutate({ id: notification.id })}
              >
                Marquer comme lue
              </ActionButton>
            )}
          </div>
        </div>
      ))}
      {visibleNotifications.length <
        allNotifications.filter(item => !onlyUnread || !item.readAt).length && (
        <ActionButton onClick={() => setVisibleCount(value => value + 10)}>
          Afficher les 10 suivantes
        </ActionButton>
      )}
    </div>
  );
}

function AdminActivity({
  onSelectRequest,
  onGoSettings,
}: {
  onSelectRequest: (id: number) => void;
  onGoSettings: () => void;
}) {
  const query = trpc.mds.admin.overview.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const d = query.data;
  const stats = d?.stats;
  const payments = (d?.payments ?? []).filter(p =>
    paymentFilter === "all"
      ? true
      : paymentFilter === "failures"
        ? ["failed", "cancelled", "expired"].includes(p.status)
        : p.status === "succeeded"
  );
  return (
    <section className="stack">
      <div className="section-heading">
        <h2>Activité & supervision</h2>
        <p className="muted">
          Vue complète de l’activité MDS : connexions, demandes reçues et
          paiements.
        </p>
      </div>
      {query.isLoading && <QueryState loading />}
      {query.error && <QueryState error={query.error} retry={query.refetch} />}
      {d && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <article
              className="panel stack"
              style={{
                background:
                  (stats?.pendingRequests ?? 0) > 0 ? "#fff5ee" : undefined,
                borderColor:
                  (stats?.pendingRequests ?? 0) > 0 ? "#bc4c23" : undefined,
              }}
            >
              <span className="small-text muted">Demandes à traiter</span>
              <strong style={{ fontSize: 28, color: "#bc4c23" }}>
                {stats?.pendingRequests ?? 0}
              </strong>
              <small className="muted">
                sur {stats?.totalRequests ?? 0} au total
              </small>
            </article>
            <article className="panel stack">
              <span className="small-text muted">Interventions actives</span>
              <strong style={{ fontSize: 28 }}>
                {(stats?.inProgressRequests ?? 0) +
                  (stats?.confirmedRequests ?? 0)}
              </strong>
              <small className="muted">en cours ou confirmées</small>
            </article>
            <article className="panel stack">
              <span className="small-text muted">Paiements reçus</span>
              <strong style={{ fontSize: 28 }}>
                {money(stats?.revenueCents ?? 0)}
              </strong>
              <small className="muted">paiements réussis</small>
            </article>
            <article className="panel stack">
              <span className="small-text muted">Clients uniques</span>
              <strong style={{ fontSize: 28 }}>{stats?.clients ?? 0}</strong>
              <small className="muted">par e-mail distinct</small>
            </article>
          </div>
          <article
            className="panel stack"
            style={{ background: "#fcf6f2", borderColor: "#e4cbbd" }}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <strong>Zone d’intervention configurée</strong>
                <p className="small-text" style={{ margin: "4px 0 0" }}>
                  {d.zone || "Aucune zone renseignée"}
                </p>
                <p className="small-text muted" style={{ margin: "2px 0 0" }}>
                  Téléphone public : {d.contactPhone || "non renseigné"} ·
                  E-mail : {d.contactEmail || "non renseigné"} · Calendrier :{" "}
                  {d.calendarEnabled ? "activé" : "désactivé"}
                </p>
              </div>
              <ActionButton onClick={onGoSettings}>
                Modifier dans les Paramètres
              </ActionButton>
            </div>
          </article>
          <article className="panel stack">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <strong>Dernières demandes reçues ({d.requests.length})</strong>
              <span className="small-text muted">
                qui fait les demandes et où
              </span>
            </div>
            {d.requests.length === 0 ? (
              <p className="muted small-text">Aucune demande enregistrée.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {d.requests.map(r => (
                  <div
                    key={r.id}
                    className="data-row row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ minWidth: 200, flex: 1 }}>
                      <div>
                        <strong>{r.name}</strong>{" "}
                        <span className="small-text muted">
                          · {r.reference}
                        </span>
                      </div>
                      <div
                        className="small-text muted"
                        style={{ marginTop: 2 }}
                      >
                        {r.phone && (
                          <a
                            href={`tel:${r.phone}`}
                            style={{ color: "#bc4c23", fontWeight: 600 }}
                          >
                            {r.phone}
                          </a>
                        )}{" "}
                        {r.email && (
                          <a href={`mailto:${r.email}`} className="text-link">
                            {r.email}
                          </a>
                        )}
                      </div>
                      <div className="small-text muted">
                        {r.serviceName || r.problemType} · {r.postcode} {r.city}{" "}
                        · {dateTime(r.createdAt)}
                      </div>
                    </div>
                    <div
                      className="row"
                      style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}
                    >
                      <StatusBadge status={r.status} />
                      <ActionButton
                        className="primary"
                        onClick={() => onSelectRequest(r.id)}
                      >
                        Ouvrir
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
          <article className="panel stack">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <strong>Dernières connexions</strong>
              <span className="small-text muted">qui se connecte et quand</span>
            </div>
            {d.users.length === 0 ? (
              <p className="muted small-text">Aucun utilisateur enregistré.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {d.users.map(u => (
                  <div
                    key={u.id}
                    className="data-row row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      padding: 12,
                    }}
                  >
                    <div>
                      <strong>{u.name || "Utilisateur"}</strong>{" "}
                      <span className="small-text muted">#{u.id}</span>
                      <div className="small-text muted">{u.email}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="badge">
                        {u.role === "admin" ? "Artisan / Admin" : "Client"}
                      </span>
                      <div
                        className="small-text muted"
                        style={{ marginTop: 2 }}
                      >
                        Dernière connexion : {dateTime(u.lastSignedIn)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
          <article className="panel stack">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <strong>Paiements & échecs ({d.payments.length})</strong>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className={paymentFilter === "all" ? "primary" : "secondary"}
                  onClick={() => setPaymentFilter("all")}
                >
                  Tous
                </ActionButton>
                <ActionButton
                  className={
                    paymentFilter === "failures" ? "primary" : "secondary"
                  }
                  onClick={() => setPaymentFilter("failures")}
                >
                  Échecs ({d.failures.length})
                </ActionButton>
                <ActionButton
                  className={paymentFilter === "ok" ? "primary" : "secondary"}
                  onClick={() => setPaymentFilter("ok")}
                >
                  Réussis
                </ActionButton>
              </div>
            </div>
            {payments.length === 0 ? (
              <p className="muted small-text">Aucun paiement dans cette vue.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {payments.map(p => {
                  const failed = ["failed", "cancelled", "expired"].includes(
                    p.status
                  );
                  const statusLabel: Record<string, string> = {
                    succeeded: "Réussi",
                    failed: "Échoué",
                    expired: "Expiré",
                    cancelled: "Annulé",
                    pending: "En attente",
                  };
                  return (
                    <div
                      key={p.id}
                      className="data-row stack"
                      style={{
                        padding: 12,
                        borderColor: failed ? "#e8b4ad" : undefined,
                        background: failed ? "#fff8f7" : undefined,
                      }}
                    >
                      <div
                        className="row"
                        style={{
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <div>
                          <strong>{money(p.amountCents)}</strong>{" "}
                          <span className="small-text muted">
                            · {p.purpose} · {p.provider} ({p.mode})
                          </span>
                          <div className="small-text muted">
                            {p.clientName}{" "}
                            {p.clientEmail ? `· ${p.clientEmail}` : ""}
                            {p.requestReference
                              ? ` · dossier ${p.requestReference}`
                              : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            className="badge"
                            style={{
                              background:
                                p.status === "succeeded"
                                  ? "#e6f4ea"
                                  : failed
                                    ? "#fde8e4"
                                    : undefined,
                              color:
                                p.status === "succeeded"
                                  ? "#1e7e34"
                                  : failed
                                    ? "#c0392b"
                                    : undefined,
                              fontWeight: 700,
                            }}
                          >
                            {statusLabel[p.status] ?? p.status}
                          </span>
                          <div
                            className="small-text muted"
                            style={{ marginTop: 2 }}
                          >
                            {dateTime(p.confirmedAt ?? p.createdAt)}
                          </div>
                        </div>
                      </div>
                      {p.failureReason && (
                        <div
                          className="row small-text"
                          style={{
                            gap: 6,
                            color: "#c0392b",
                            alignItems: "center",
                            marginTop: 4,
                          }}
                        >
                          <AlertTriangle size={15} aria-hidden="true" />
                          <strong>Motif de l’échec :</strong> {p.failureReason}
                        </div>
                      )}
                      {p.verificationNote && (
                        <p className="small-text muted" style={{ margin: 0 }}>
                          {p.verificationNote}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
