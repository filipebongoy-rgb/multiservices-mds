import { useState } from "react";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  LockKeyhole,
  Settings2,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { dateTime } from "@shared/mds";
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
          <span className="eyebrow">Espace privé MDS</span>
          <LockKeyhole size={30} aria-hidden="true" />
          <h1 className="page-title">L’atelier de l’artisan</h1>
          <p className="muted">Connectez-vous pour accéder à vos dossiers.</p>
          <LoginButton />
        </section>
      </main>
    );
  if (auth.user.role !== "admin")
    return (
      <ArtisanActivation name={auth.user.name} onActivated={auth.refresh} />
    );
  return <ArtisanWorkspace />;
}
function ArtisanActivation({
  name,
  onActivated,
}: {
  name: string | null;
  onActivated: () => unknown;
}) {
  const [code, setCode] = useState("");
  const claim = trpc.mds.claimArtisan.useMutation({
    onSuccess: () => {
      setCode("");
      void onActivated();
    },
  });
  return (
    <main className="page-shell">
      <section
        className="panel stack"
        style={{ maxWidth: 640, margin: "48px auto" }}
      >
        <span className="eyebrow">Accès réservé</span>
        <h1 className="page-title">Activer l’espace artisan</h1>
        <p>
          Vous êtes connecté{name ? ` en tant que ${name}` : ""}, sans accès
          administrateur.
        </p>
        <p className="muted">
          Le code privé d’activation est réservé au propriétaire MDS.
        </p>
        <form
          className="stack"
          onSubmit={e => {
            e.preventDefault();
            claim.mutate({ code: code.trim() });
          }}
        >
          <Field label="Code privé d’activation">
            <input
              type="password"
              value={code}
              autoComplete="off"
              pattern="[a-f0-9]{64}"
              minLength={64}
              maxLength={64}
              title="Code privé de 64 caractères fourni au propriétaire MDS"
              required
              onChange={e => setCode(e.target.value)}
            />
          </Field>
          <ErrorNotice error={claim.error} />
          <ActionButton
            type="submit"
            className="primary"
            disabled={claim.isPending || !code.trim()}
          >
            {claim.isPending ? "Vérification…" : "Activer mon accès artisan"}
          </ActionButton>
        </form>
        <a
          className="text-link"
          style={{
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
          }}
          href="/professionnels"
        >
          Accéder à mon espace professionnel
        </a>
      </section>
    </main>
  );
}
function ArtisanWorkspace() {
  const [tab, setTab] = useState<Tab>("requests");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const requestsQuery = trpc.mds.requests.list.useQuery(undefined, {
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
  const openRequest = (id: number) => {
    setSelectedId(id);
    setTab("requests");
  };
  const refreshRequests = () => {
    void requestsQuery.refetch();
    void appointmentsQuery.refetch();
    void utils.mds.calendar.get.invalidate();
  };
  return (
    <main
      className="page-shell private-workspace"
      style={{ paddingTop: 24, paddingBottom: 64 }}
    >
      <header
        className="row"
        style={{
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <span className="eyebrow">Artisan MDS</span>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Votre atelier
          </h1>
        </div>
        <span className="badge row">
          <Wrench size={16} aria-hidden="true" /> Accès privé
        </span>
      </header>
      <nav
        className="row"
        aria-label="Espace artisan"
        style={{ flexWrap: "wrap", gap: 8, marginBottom: 24 }}
      >
        {navigation.map(item => (
          <ActionButton
            key={item.id}
            className={tab === item.id ? "primary" : "secondary"}
            onClick={() => {
              setTab(item.id);
              setSelectedId(null);
            }}
            aria-current={tab === item.id ? "page" : undefined}
            style={{ flex: "1 1 140px", minHeight: 48 }}
          >
            <item.icon size={19} aria-hidden="true" />
            {item.name}
          </ActionButton>
        ))}
      </nav>
      <div className="stack" style={{ minWidth: 0 }}>
        {tab === "requests" && (
          <>
            <TodaySummary
              pending={pending.length}
              appointments={appointments}
              requestsLoading={requestsQuery.isLoading}
              requestsError={requestsQuery.error}
              appointmentsLoading={appointmentsQuery.isLoading}
              appointmentsError={appointmentsQuery.error}
              onPlanning={() => setTab("planning")}
            />
            <ActionButton
              aria-pressed={showHistory}
              onClick={() => setShowHistory(value => !value)}
              style={{ alignSelf: "flex-start" }}
            >
              {showHistory
                ? "Voir les demandes à traiter"
                : "Historique des demandes"}
            </ActionButton>
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
      </div>
    </main>
  );
}
function TodaySummary({
  pending,
  appointments,
  requestsLoading,
  requestsError,
  appointmentsLoading,
  appointmentsError,
  onPlanning,
}: {
  pending: number;
  appointments: Appointment[];
  requestsLoading: boolean;
  requestsError: unknown;
  appointmentsLoading: boolean;
  appointmentsError: unknown;
  onPlanning: () => void;
}) {
  const today = dayKey(new Date());
  const count = appointments.filter(
    a => a.status !== "cancelled" && dayKey(a.startAt) === today
  ).length;
  return (
    <div
      className="row"
      style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
    >
      <p>
        <strong>{requestsLoading || requestsError ? "—" : pending}</strong>{" "}
        demande{pending !== 1 ? "s" : ""} à traiter
      </p>
      <ActionButton onClick={onPlanning}>
        <CalendarDays size={18} aria-hidden="true" />{" "}
        {appointmentsLoading || appointmentsError ? "—" : count} rendez-vous
        aujourd’hui
      </ActionButton>
    </div>
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
        <div className="split-view" style={{ alignItems: "start" }}>
          <div className="panel stack">
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
                onClick={() => onSelect(request.id)}
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
                }}
              >
                <strong>{request.name}</strong>
                <p>
                  {request.serviceName || "Demande libre"} · {request.city}
                </p>
                <StatusBadge status={request.status} />
                {request.proposedStart && (
                  <p className="muted">{dateTime(request.proposedStart)}</p>
                )}
              </button>
            ))}
          </div>
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
      )}
    </section>
  );
}
function Notifications({ onOpen }: { onOpen: (id: number) => void }) {
  const notifications = trpc.mds.notifications.list.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const read = trpc.mds.notifications.read.useMutation({
    onSuccess: () => void notifications.refetch(),
  });
  return (
    <div className="stack" style={{ paddingTop: 16 }}>
      <QueryState
        loading={notifications.isLoading}
        error={notifications.error}
        retry={notifications.refetch}
        empty={notifications.data?.length === 0}
        emptyText="Aucune notification."
      />
      <ErrorNotice error={read.error} />
      {notifications.data?.slice(0, 10).map(notification => (
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
    </div>
  );
}
