import { useState } from "react";
import {
  Building2,
  Copy,
  FileText,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { dateTime } from "@shared/mds";
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
import type { PrivateDocument, RequestRecord } from "./private-types";

export const organizationTypes = [
  { id: "entreprise", name: "Entreprise" },
  { id: "syndic", name: "Syndic" },
  { id: "bailleur", name: "Bailleur" },
  { id: "gestionnaire", name: "Gestionnaire" },
  { id: "association", name: "Association" },
  { id: "collectivite", name: "Collectivité" },
] as const;
export type OrganizationType = (typeof organizationTypes)[number]["id"];
export type OrganizationSummary = {
  id: number;
  name: string;
  type: string;
  role: string;
};
type Site = {
  id: number;
  name: string;
  address: string;
  postcode: string;
  city: string;
  contactName: string;
  contactPhone: string;
};
const roleLabel = (role: string) =>
  role === "owner"
    ? "Propriétaire"
    : role === "manager"
      ? "Gestionnaire"
      : "Collaborateur";

export function OrganizationDetail({
  summary,
  currentUserId,
}: {
  summary: OrganizationSummary;
  currentUserId: number;
}) {
  const detail = trpc.mds.organizations.detail.useQuery(
    { id: summary.id },
    { retry: false, refetchInterval: 30_000 }
  );
  const [tab, setTab] = useState<
    "requests" | "sites" | "members" | "documents" | "contracts"
  >("requests");
  const [modal, setModal] = useState<"site" | "invite" | null>(null);
  const [removing, setRemoving] = useState<{
    userId: number;
    name: string | null;
    email: string | null;
  } | null>(null);
  const remove = trpc.mds.organizations.removeMember.useMutation({
    onSuccess: () => {
      setRemoving(null);
      void detail.refetch();
    },
  });
  const canManage = summary.role === "manager" || summary.role === "owner";
  const data = detail.data;
  return (
    <section className="stack" aria-label={`Organisation ${summary.name}`}>
      <header
        className="panel row"
        style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}
      >
        <div>
          <span className="eyebrow">
            {organizationTypes.find(type => type.id === summary.type)?.name ||
              summary.type}
          </span>
          <h2 style={{ fontSize: 27 }}>{summary.name}</h2>
          <span className="badge row">
            <ShieldCheck size={15} aria-hidden="true" />
            {roleLabel(summary.role)}
          </span>
        </div>
        <a
          href={`/demande?org=${summary.id}`}
          className="btn primary"
          style={{ minHeight: 44 }}
        >
          Déclarer une intervention
        </a>
      </header>
      <div
        className="tabs row"
        style={{ flexWrap: "wrap" }}
        aria-label="Rubriques de l’organisation"
      >
        {(
          [
            ["requests", "Interventions"],
            ["sites", "Sites"],
            ["members", "Contacts autorisés"],
            ["documents", "Devis et factures"],
            ["contracts", "Contrats"],
          ] as const
        ).map(([id, label]) => (
          <ActionButton
            key={id}
            className={tab === id ? "dark" : "secondary"}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </ActionButton>
        ))}
      </div>
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        retry={detail.refetch}
      />
      {data && !detail.error && (
        <>
          {tab === "requests" && (
            <section className="panel stack">
              <h3>Interventions de l’organisation</h3>
              <p className="muted">
                Le serveur limite ces dossiers aux organisations auxquelles vous
                appartenez.
              </p>
              <OrganizationRequests
                requests={data.requests}
                sites={data.sites}
              />
            </section>
          )}
          {tab === "sites" && (
            <section className="panel stack">
              <div
                className="row"
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <h3>Sites et lieux d’intervention</h3>
                {canManage && (
                  <ActionButton
                    className="primary"
                    onClick={() => setModal("site")}
                  >
                    <Plus size={17} aria-hidden="true" />
                    Ajouter un site
                  </ActionButton>
                )}
              </div>
              {data.sites.length === 0 ? (
                <div className="empty">
                  Aucun site enregistré.{" "}
                  {canManage
                    ? "Ajoutez votre premier lieu d’intervention."
                    : "Un gestionnaire peut ajouter les sites."}
                </div>
              ) : (
                data.sites.map(site => (
                  <article key={site.id} className="data-row stack">
                    <h4 className="row">
                      <Building2 size={18} aria-hidden="true" />
                      {site.name}
                    </h4>
                    <p className="row">
                      <MapPin size={16} aria-hidden="true" />
                      {site.address}, {site.postcode} {site.city}
                    </p>
                    {site.contactName && (
                      <p className="muted">
                        Contact sur place : {site.contactName}
                        {site.contactPhone ? ` · ${site.contactPhone}` : ""}
                      </p>
                    )}
                    <a
                      className="btn secondary"
                      style={{ minHeight: 44, alignSelf: "start" }}
                      href={`/demande?org=${summary.id}&site=${site.id}`}
                    >
                      Déclarer sur ce site
                    </a>
                  </article>
                ))
              )}
            </section>
          )}
          {tab === "members" && (
            <section className="panel stack">
              <div
                className="row"
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <h3>Contacts autorisés</h3>
                {canManage && (
                  <ActionButton
                    className="primary"
                    onClick={() => setModal("invite")}
                  >
                    <UserPlus size={17} aria-hidden="true" />
                    Inviter un contact
                  </ActionButton>
                )}
              </div>
              <p className="muted">
                Les invitations sont partagées manuellement par code. Aucun
                email n’est envoyé par l’application.
              </p>
              {data.members.length === 0 ? (
                <div className="empty">Aucun membre accessible.</div>
              ) : (
                data.members.map(member => (
                  <div
                    key={member.id}
                    className="data-row row"
                    style={{
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>
                        {member.name || member.email || "Compte authentifié"}
                      </strong>
                      <p className="muted" style={{ overflowWrap: "anywhere" }}>
                        {member.email}
                      </p>
                      <span className="badge">
                        {roleLabel(member.role)}
                        {member.userId === currentUserId ? " · vous" : ""}
                      </span>
                    </div>
                    {canManage &&
                      member.role !== "owner" &&
                      member.userId !== currentUserId &&
                      member.userId !== data.organization.ownerUserId && (
                        <ActionButton
                          className="secondary danger"
                          onClick={() => setRemoving(member)}
                          aria-label={`Retirer ${member.name || member.email || "ce contact"}`}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                          Retirer
                        </ActionButton>
                      )}
                  </div>
                ))
              )}
              {canManage && (
                <section className="stack" style={{ marginTop: 16 }}>
                  <h4>Invitations en attente</h4>
                  {data.invitations.length === 0 ? (
                    <p className="muted">Aucune invitation en attente.</p>
                  ) : (
                    data.invitations.map(invitation => (
                      <div key={invitation.id} className="data-row">
                        <strong>{invitation.email}</strong>
                        <p className="muted">
                          {roleLabel(invitation.role)} · créée le{" "}
                          {dateTime(invitation.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                  <p className="muted">
                    Les codes ne sont affichés qu’à leur création. Le compte qui
                    rejoint doit utiliser l’email invité.
                  </p>
                </section>
              )}
            </section>
          )}
          {tab === "documents" && (
            <OrganizationDocuments documents={data.documents} />
          )}
          {tab === "contracts" && (
            <section className="panel stack">
              <h3>Contrats réels</h3>
              <p className="muted">
                Documents indexés pour cette organisation, sans contrat de
                démonstration.
              </p>
              {data.contracts.length === 0 ? (
                <div className="empty">Aucun contrat indexé.</div>
              ) : (
                data.contracts.map(contract => (
                  <article className="data-row stack" key={contract.id}>
                    <h4>{contract.name}</h4>
                    <span className="badge" style={{ alignSelf: "start" }}>
                      {contract.status === "indexed"
                        ? "Document indexé"
                        : contract.status === "active"
                          ? "Actif"
                          : contract.status === "ended"
                            ? "Terminé"
                            : contract.status}
                    </span>
                    {(contract.startAt || contract.endAt) && (
                      <p className="muted">
                        {contract.startAt
                          ? `Début : ${dateTime(contract.startAt)}`
                          : "Début non renseigné"}{" "}
                        ·{" "}
                        {contract.endAt
                          ? `Fin : ${dateTime(contract.endAt)}`
                          : "Fin non renseignée"}
                      </p>
                    )}
                    <DocumentList
                      documents={data.documents.filter(
                        document => document.id === contract.documentId
                      )}
                      emptyText="Le document rattaché n’est pas accessible dans cet index."
                    />
                  </article>
                ))
              )}
              {canManage && (
                <details>
                  <summary
                    style={{
                      minHeight: 44,
                      padding: "12px 0",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Déposer un contrat existant
                  </summary>
                  <p className="muted" style={{ marginBottom: 16 }}>
                    Déposez un contrat PDF réel. Son indexation ne présume pas
                    qu’il est signé ou actif.
                  </p>
                  <UploadDocument
                    kind="contract"
                    organizationId={summary.id}
                    onUploaded={() => void detail.refetch()}
                  />
                </details>
              )}
            </section>
          )}
        </>
      )}
      {modal === "site" && (
        <AddSite
          organizationId={summary.id}
          onClose={() => setModal(null)}
          onAdded={() => {
            setModal(null);
            void detail.refetch();
          }}
        />
      )}
      {modal === "invite" && (
        <InviteMember
          organizationId={summary.id}
          onClose={() => {
            setModal(null);
            void detail.refetch();
          }}
        />
      )}
      {removing && (
        <PrivateModal
          title="Retirer ce contact ?"
          description={`${removing.name || removing.email || "Ce compte"} n’aura plus accès aux dossiers de cette organisation. Le propriétaire ne peut pas être retiré.`}
          onClose={() => setRemoving(null)}
        >
          <ErrorNotice error={remove.error} />
          <div className="row">
            <ActionButton
              className="dark"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate({
                  organizationId: summary.id,
                  userId: removing.userId,
                })
              }
            >
              Confirmer le retrait
            </ActionButton>
            <ActionButton
              disabled={remove.isPending}
              onClick={() => setRemoving(null)}
            >
              Retour
            </ActionButton>
          </div>
        </PrivateModal>
      )}
    </section>
  );
}
function OrganizationRequests({
  requests,
  sites,
}: {
  requests: RequestRecord[];
  sites: Site[];
}) {
  const [search, setSearch] = useState("");
  const filtered = requests.filter(request =>
    `${request.reference} ${request.serviceName || ""} ${request.description}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <div className="stack">
      <Field label="Rechercher une intervention">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Référence ou prestation"
        />
      </Field>
      {filtered.length === 0 ? (
        <div className="empty">
          {requests.length
            ? "Aucun dossier ne correspond à votre recherche."
            : "Aucune intervention déclarée pour cette organisation."}
        </div>
      ) : (
        filtered.map(request => (
          <article
            key={request.id}
            className="data-row row"
            style={{
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong>{request.serviceName || "Demande libre"}</strong>
              <p className="muted">
                {request.reference} ·{" "}
                {sites.find(site => site.id === request.siteId)?.name ||
                  request.city}
              </p>
              <StatusBadge status={request.status} />
              <p className="muted">Déclarée le {dateTime(request.createdAt)}</p>
            </div>
            <a
              className="btn secondary"
              style={{ minHeight: 44 }}
              href={`/suivi?ref=${encodeURIComponent(request.reference)}`}
            >
              Consulter le suivi
            </a>
          </article>
        ))
      )}
    </div>
  );
}
function OrganizationDocuments({
  documents,
}: {
  documents: PrivateDocument[];
}) {
  const [kind, setKind] = useState<"quote" | "invoice">("quote");
  return (
    <section className="panel stack">
      <h3>Devis et factures</h3>
      <div className="tabs row">
        <ActionButton
          className={kind === "quote" ? "dark" : "secondary"}
          aria-pressed={kind === "quote"}
          onClick={() => setKind("quote")}
        >
          <FileText size={17} aria-hidden="true" />
          Devis
        </ActionButton>
        <ActionButton
          className={kind === "invoice" ? "dark" : "secondary"}
          aria-pressed={kind === "invoice"}
          onClick={() => setKind("invoice")}
        >
          Factures
        </ActionButton>
      </div>
      <p className="muted">
        Téléchargement après vérification de votre accès par le serveur.
      </p>
      <DocumentList
        documents={documents.filter(document => document.kind === kind)}
        emptyText={
          kind === "quote"
            ? "Aucun devis déposé pour cette organisation."
            : "Aucune facture déposée pour cette organisation."
        }
      />
    </section>
  );
}
function AddSite({
  organizationId,
  onClose,
  onAdded,
}: {
  organizationId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [values, setValues] = useState({
    name: "",
    address: "",
    postcode: "",
    city: "",
    contactName: "",
    contactPhone: "",
  });
  const add = trpc.mds.organizations.addSite.useMutation({
    onSuccess: onAdded,
  });
  const update = (key: keyof typeof values, value: string) =>
    setValues(previous => ({ ...previous, [key]: value }));
  return (
    <PrivateModal
      title="Ajouter un site"
      description="Ce lieu d’intervention sera partagé avec les membres autorisés de l’organisation."
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          add.mutate({ organizationId, ...values });
        }}
      >
        <Field label="Nom du site">
          <input
            required
            minLength={2}
            maxLength={150}
            value={values.name}
            onChange={e => update("name", e.target.value)}
          />
        </Field>
        <Field label="Adresse">
          <input
            required
            minLength={5}
            maxLength={250}
            autoComplete="street-address"
            value={values.address}
            onChange={e => update("address", e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="Code postal">
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              autoComplete="postal-code"
              value={values.postcode}
              onChange={e => update("postcode", e.target.value)}
            />
          </Field>
          <Field label="Ville">
            <input
              required
              minLength={2}
              maxLength={100}
              autoComplete="address-level2"
              value={values.city}
              onChange={e => update("city", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Contact sur place (facultatif)">
          <input
            maxLength={120}
            value={values.contactName}
            onChange={e => update("contactName", e.target.value)}
          />
        </Field>
        <Field label="Téléphone sur place (facultatif)">
          <input
            type="tel"
            maxLength={30}
            value={values.contactPhone}
            onChange={e => update("contactPhone", e.target.value)}
          />
        </Field>
        <ErrorNotice error={add.error} />
        <ActionButton
          type="submit"
          className="primary"
          disabled={add.isPending}
        >
          {add.isPending ? "Enregistrement…" : "Ajouter le site"}
        </ActionButton>
      </form>
    </PrivateModal>
  );
}
function InviteMember({
  organizationId,
  onClose,
}: {
  organizationId: number;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "member">("member");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<unknown>(null);
  const invite = trpc.mds.organizations.invite.useMutation();
  const code = invite.data?.invitationCode;
  return (
    <PrivateModal
      title={code ? "Code d’invitation créé" : "Inviter un contact"}
      description="Invitation manuelle, sans envoi d’email par l’application."
      onClose={onClose}
    >
      {code ? (
        <div className="stack">
          <p>
            Partagez ce code en privé avec <strong>{email}</strong>. Le contact
            doit se connecter avec cet email pour rejoindre l’organisation.
          </p>
          <Field
            label="Code à partager"
            hint="Ce code ne sera pas réaffiché après fermeture."
          >
            <textarea
              rows={3}
              readOnly
              value={code}
              onFocus={e => e.target.select()}
              style={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
            />
          </Field>
          <ActionButton
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              } catch {
                setCopyError(
                  new Error(
                    "Copie automatique indisponible. Sélectionnez et copiez le code ci-dessus."
                  )
                );
              }
            }}
          >
            <Copy size={17} aria-hidden="true" />
            {copied ? "Code copié" : "Copier le code"}
          </ActionButton>
          <ErrorNotice error={copyError} />
          <ActionButton className="primary" onClick={onClose}>
            Fermer
          </ActionButton>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={e => {
            e.preventDefault();
            invite.mutate({ organizationId, email: email.trim(), role });
          }}
        >
          <Field label="Email du compte à autoriser">
            <input
              required
              type="email"
              maxLength={320}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Droits dans cette organisation">
            <select
              value={role}
              onChange={e => setRole(e.target.value as "manager" | "member")}
            >
              <option value="member">
                Collaborateur — consulter et déclarer
              </option>
              <option value="manager">
                Gestionnaire — gérer les sites et les contacts
              </option>
            </select>
          </Field>
          <ErrorNotice error={invite.error} />
          <ActionButton
            type="submit"
            className="primary"
            disabled={invite.isPending}
          >
            {invite.isPending ? "Création…" : "Créer le code d’invitation"}
          </ActionButton>
        </form>
      )}
    </PrivateModal>
  );
}
