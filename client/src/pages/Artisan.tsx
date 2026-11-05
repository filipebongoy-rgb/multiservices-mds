import { useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Settings2,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { dateTime } from "@shared/mds";
import {
  ActionButton,
  DocumentList,
  ErrorNotice,
  Field,
  LoginButton,
  QueryState,
  StatusBadge,
  UploadDocument,
} from "@/components/mds/private-common";
import { ArtisanRequests } from "@/components/mds/private-artisan-requests";
import { ArtisanSettings } from "@/components/mds/private-artisan-settings";
import {
  activeRequestStatuses,
  dayKey,
  type Appointment,
  type RequestRecord,
  type Service,
} from "@/components/mds/private-types";
import "@/components/mds/private.css";

const navigation = [
  { id: "today", name: "Aujourd’hui", icon: LayoutDashboard },
  { id: "requests", name: "Demandes", icon: ClipboardList },
  { id: "planning", name: "Planning", icon: CalendarDays },
  { id: "quotes", name: "Devis", icon: FileText },
  { id: "clients", name: "Clients", icon: Users },
  { id: "invoices", name: "Factures", icon: FileCheck2 },
  { id: "settings", name: "Paramètres", icon: Settings2 },
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
          <p className="muted">
            Connectez-vous pour accéder à vos dossiers. Cet espace est réservé à
            l’artisan MDS ; aucun compte de démonstration ne donne accès aux
            demandes.
          </p>
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
          Seul le propriétaire MDS disposant du code privé d’activation peut
          activer cet espace. Ne partagez pas ce code.
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
          Accéder plutôt à mon espace professionnel
        </a>
      </section>
    </main>
  );
}
function ArtisanWorkspace() {
  const [tab, setTab] = useState<Tab>("today");
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
  const requests = requestsQuery.data ?? [];
  const services = catalogQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];
  const openRequest = (id: number) => {
    setSelectedId(id);
    setTab("requests");
  };
  const refreshRequests = () => {
    void requestsQuery.refetch();
    void appointmentsQuery.refetch();
  };
  return (
    <main
      className="page-shell private-workspace"
      style={{ paddingTop: 32, paddingBottom: 64 }}
    >
      <header
        className="row"
        style={{
          justifyContent: "space-between",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <span className="eyebrow">Espace artisan · MDS</span>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Votre atelier, au clair.
          </h1>
        </div>
        <span className="badge row">
          <Wrench size={16} aria-hidden="true" />
          Accès artisan autorisé
        </span>
      </header>
      <div className="workspace">
        <nav className="workspace-nav" aria-label="Espace artisan">
          {navigation.map(item => (
            <button
              key={item.id}
              type="button"
              className={`btn ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              style={{ minHeight: 48, justifyContent: "flex-start", gap: 12 }}
            >
              <item.icon size={19} aria-hidden="true" />
              {item.name}
            </button>
          ))}
        </nav>
        <div className="workspace-main" style={{ minWidth: 0 }}>
          {tab === "today" && (
            <Today
              requests={requests}
              appointments={appointments}
              requestsLoading={requestsQuery.isLoading}
              requestsError={requestsQuery.error}
              retryRequests={requestsQuery.refetch}
              appointmentsLoading={appointmentsQuery.isLoading}
              appointmentsError={appointmentsQuery.error}
              retryAppointments={appointmentsQuery.refetch}
              onOpen={openRequest}
              onPlanning={() => setTab("planning")}
            />
          )}
          {tab === "requests" && (
            <ArtisanRequests
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
          {tab === "planning" && (
            <Planning
              appointments={appointments}
              loading={appointmentsQuery.isLoading}
              error={appointmentsQuery.error}
              retry={appointmentsQuery.refetch}
              onOpen={openRequest}
            />
          )}
          {(tab === "quotes" || tab === "invoices") && (
            <ArtisanDocuments
              key={tab}
              kind={tab === "quotes" ? "quote" : "invoice"}
              requests={requests}
              loading={requestsQuery.isLoading}
              error={requestsQuery.error}
              retry={requestsQuery.refetch}
              onOpen={openRequest}
            />
          )}
          {tab === "clients" && (
            <Clients
              requests={requests}
              loading={requestsQuery.isLoading}
              error={requestsQuery.error}
              retry={requestsQuery.refetch}
              onOpen={openRequest}
            />
          )}
          {tab === "settings" && (
            <ArtisanSettings
              services={services}
              catalogLoading={catalogQuery.isLoading}
              catalogError={catalogQuery.error}
              retryCatalog={catalogQuery.refetch}
              onCatalogChanged={() => void catalogQuery.refetch()}
            />
          )}
        </div>
      </div>
    </main>
  );
}
function Today({
  requests,
  appointments,
  requestsLoading,
  requestsError,
  retryRequests,
  appointmentsLoading,
  appointmentsError,
  retryAppointments,
  onOpen,
  onPlanning,
}: {
  requests: RequestRecord[];
  appointments: Appointment[];
  requestsLoading: boolean;
  requestsError: unknown;
  retryRequests: () => unknown;
  appointmentsLoading: boolean;
  appointmentsError: unknown;
  retryAppointments: () => unknown;
  onOpen: (id: number) => void;
  onPlanning: () => void;
}) {
  const pending = requests.filter(request =>
    activeRequestStatuses.includes(request.status)
  );
  const today = dayKey(new Date());
  const todayAppointments = appointments
    .filter(
      appointment =>
        appointment.status !== "cancelled" &&
        dayKey(appointment.startAt) === today
    )
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  return (
    <div className="stack">
      <div className="section-heading">
        <h2>Aujourd’hui</h2>
        <p className="muted">
          Les dossiers à traiter et les rendez-vous validés. Rien de plus.
        </p>
      </div>
      <div className="metric-row">
        <div className="metric">
          <span className="muted">Dossiers en attente</span>
          <strong style={{ fontSize: 36 }}>
            {requestsLoading || requestsError ? "—" : pending.length}
          </strong>
          <span className="muted">MDS ou client</span>
        </div>
        <div className="metric">
          <span className="muted">Rendez-vous aujourd’hui</span>
          <strong style={{ fontSize: 36 }}>
            {appointmentsLoading || appointmentsError
              ? "—"
              : todayAppointments.length}
          </strong>
          <span className="muted">Heure de Paris</span>
        </div>
      </div>
      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>À traiter</h3>
          <ClipboardList size={20} aria-hidden="true" />
        </div>
        <QueryState
          loading={requestsLoading}
          error={requestsError}
          retry={retryRequests}
          empty={!requestsLoading && !requestsError && pending.length === 0}
          emptyText="Aucun dossier en attente pour le moment."
        />
        {!requestsError &&
          pending.slice(0, 6).map(request => (
            <button
              type="button"
              key={request.id}
              className="data-row row"
              onClick={() => onOpen(request.id)}
              style={{
                minHeight: 70,
                width: "100%",
                border: 0,
                borderBottom: "1px solid #e7e5e2",
                background: "transparent",
                textAlign: "left",
                justifyContent: "space-between",
                cursor: "pointer",
                gap: 12,
              }}
            >
              <div>
                <strong>{request.name}</strong>
                <p className="muted">
                  {request.serviceName || "Demande libre"} · {request.reference}
                </p>
                <StatusBadge status={request.status} />
              </div>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          ))}
      </section>
      <section className="panel stack">
        <div
          className="row"
          style={{ justifyContent: "space-between", flexWrap: "wrap" }}
        >
          <h3>Rendez-vous du jour</h3>
          <ActionButton onClick={onPlanning}>Voir le planning</ActionButton>
        </div>
        <QueryState
          loading={appointmentsLoading}
          error={appointmentsError}
          retry={retryAppointments}
          empty={
            !appointmentsLoading &&
            !appointmentsError &&
            todayAppointments.length === 0
          }
          emptyText="Aucun rendez-vous confirmé aujourd’hui."
        />
        {!appointmentsError &&
          todayAppointments.map(appointment => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              onOpen={onOpen}
            />
          ))}
      </section>
      <Notifications onOpen={onOpen} />
    </div>
  );
}
function AppointmentRow({
  appointment,
  onOpen,
}: {
  appointment: Appointment;
  onOpen: (id: number) => void;
}) {
  return (
    <div
      className="data-row row"
      style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
    >
      <div>
        <strong>{dateTime(appointment.startAt)}</strong>
        <p>Jusqu’au {dateTime(appointment.endAt)}</p>
        <p>
          {appointment.name} · {appointment.address}
        </p>
        <span className="muted">{appointment.reference}</span>
      </div>
      <ActionButton onClick={() => onOpen(appointment.requestId)}>
        Ouvrir le dossier
      </ActionButton>
    </div>
  );
}
function Planning({
  appointments,
  loading,
  error,
  retry,
  onOpen,
}: {
  appointments: Appointment[];
  loading: boolean;
  error: unknown;
  retry: () => unknown;
  onOpen: (id: number) => void;
}) {
  const [date, setDate] = useState("");
  const confirmed = appointments
    .filter(
      appointment =>
        appointment.status !== "cancelled" &&
        (!date || dayKey(appointment.startAt) === date)
    )
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  return (
    <div className="stack">
      <div className="section-heading">
        <h2>Planning</h2>
        <p className="muted">
          Uniquement les rendez-vous effectivement confirmés par MDS et le
          client.
        </p>
      </div>
      <p className="notice">
        Le calendrier avancé et la gestion des disponibilités seront poursuivis
        au prompt 2/3. Cette liste ne représente pas des créneaux réservables.
      </p>
      <section className="panel stack">
        <div className="row" style={{ alignItems: "end", flexWrap: "wrap" }}>
          <Field label="Filtrer par date (heure de Paris)">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </Field>
          {date && (
            <ActionButton onClick={() => setDate("")}>
              Toutes les dates
            </ActionButton>
          )}
        </div>
        <QueryState
          loading={loading}
          error={error}
          retry={retry}
          empty={!loading && !error && confirmed.length === 0}
          emptyText="Aucun rendez-vous confirmé pour cette sélection."
        />
        {!error &&
          !loading &&
          confirmed.map(appointment => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              onOpen={onOpen}
            />
          ))}
      </section>
    </div>
  );
}
function ArtisanDocuments({
  kind,
  requests,
  loading,
  error,
  retry,
  onOpen,
}: {
  kind: "quote" | "invoice";
  requests: RequestRecord[];
  loading: boolean;
  error: unknown;
  retry: () => unknown;
  onOpen: (id: number) => void;
}) {
  const [uploadReference, setUploadReference] = useState("");
  const results = trpc.useQueries(router =>
    requests.map(request =>
      router.mds.requests.detail(
        { id: request.id },
        { retry: false, staleTime: 30_000 }
      )
    )
  );
  const documentGroups = results.flatMap((result, index) => {
    const data = result.data;
    if (!data) return [];
    const documents = data.documents.filter(document => document.kind === kind);
    return documents.length ? [{ request: requests[index], documents }] : [];
  });
  const reading = results.some(result => result.isLoading);
  const firstError = results.find(result => result.error)?.error;
  const refresh = () => {
    results.forEach(result => void result.refetch());
  };
  return (
    <div className="stack">
      <div className="section-heading">
        <h2>{kind === "quote" ? "Devis" : "Factures"}</h2>
        <p className="muted">
          Documents PDF réellement déposés dans les dossiers. Aucun document
          n’est généré automatiquement.
        </p>
      </div>
      <section className="panel stack">
        <QueryState
          loading={loading || reading}
          error={error || firstError}
          retry={error ? retry : refresh}
          empty={
            !loading &&
            !reading &&
            !error &&
            !firstError &&
            documentGroups.length === 0
          }
          emptyText={
            kind === "quote" ? "Aucun devis déposé." : "Aucune facture déposée."
          }
        />
        {documentGroups.map(group => (
          <section className="stack" key={group.request.id}>
            <div
              className="row"
              style={{ justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <h3>
                {group.request.name} · {group.request.reference}
              </h3>
              <ActionButton onClick={() => onOpen(group.request.id)}>
                Ouvrir le dossier
              </ActionButton>
            </div>
            <DocumentList
              documents={group.documents}
              reference={group.request.reference}
            />
          </section>
        ))}
      </section>
      <section className="panel stack">
        <h3>
          Déposer un {kind === "quote" ? "devis" : "document de facturation"}
        </h3>
        <Field label="Dossier de rattachement">
          <select
            value={uploadReference}
            onChange={e => setUploadReference(e.target.value)}
          >
            <option value="">Choisir une demande</option>
            {requests.map(request => (
              <option key={request.id} value={request.reference}>
                {request.reference} — {request.name}
              </option>
            ))}
          </select>
        </Field>
        {uploadReference && (
          <UploadDocument
            key={uploadReference}
            reference={uploadReference}
            kind={kind}
            onUploaded={refresh}
          />
        )}
        {requests.length === 0 && !loading && (
          <p className="muted">
            Un document doit être rattaché à une demande réelle.
          </p>
        )}
      </section>
    </div>
  );
}
function Clients({
  requests,
  loading,
  error,
  retry,
  onOpen,
}: {
  requests: RequestRecord[];
  loading: boolean;
  error: unknown;
  retry: () => unknown;
  onOpen: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const groups = new Map<
    string,
    { name: string; email: string; phone: string; requests: RequestRecord[] }
  >();
  requests.forEach(request => {
    const key = request.email.toLowerCase();
    const current = groups.get(key);
    if (current) current.requests.push(request);
    else
      groups.set(key, {
        name: request.name,
        email: request.email,
        phone: request.phone,
        requests: [request],
      });
  });
  const clients = [...groups.values()].filter(client =>
    `${client.name} ${client.email}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <div className="stack">
      <div className="section-heading">
        <h2>Clients</h2>
        <p className="muted">
          Contacts issus des demandes reçues, regroupés par email. Aucun fichier
          client fictif.
        </p>
      </div>
      <section className="panel stack">
        <Field label="Rechercher un contact">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom ou email"
          />
        </Field>
        <QueryState
          loading={loading}
          error={error}
          retry={retry}
          empty={!loading && !error && clients.length === 0}
          emptyText="Aucun contact dans cette sélection."
        />
        {!error &&
          clients.map(client => (
            <details key={client.email} className="data-row">
              <summary
                style={{ minHeight: 44, cursor: "pointer", padding: "8px 0" }}
              >
                <strong>{client.name}</strong> · {client.requests.length}{" "}
                dossier{client.requests.length !== 1 ? "s" : ""}
              </summary>
              <div className="stack">
                <p style={{ overflowWrap: "anywhere" }}>
                  {client.email} · {client.phone}
                </p>
                {client.requests.map(request => (
                  <div
                    className="row"
                    key={request.id}
                    style={{
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{request.reference}</strong>
                      <p>{request.serviceName || "Demande libre"}</p>
                      <StatusBadge status={request.status} />
                    </div>
                    <ActionButton onClick={() => onOpen(request.id)}>
                      Consulter
                    </ActionButton>
                  </div>
                ))}
              </div>
            </details>
          ))}
      </section>
    </div>
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
    <section className="panel stack">
      <h3 className="row">
        <Bell size={20} aria-hidden="true" />
        Notifications internes
      </h3>
      <p className="muted">
        Notifications enregistrées dans l’application. Aucun email ou SMS n’est
        annoncé comme envoyé.
      </p>
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
                Voir le dossier
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
    </section>
  );
}
