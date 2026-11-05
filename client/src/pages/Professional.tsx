import { useState } from "react";
import { Building2, KeyRound, Plus, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ActionButton,
  ErrorNotice,
  Field,
  LoginButton,
  PrivateModal,
  QueryState,
} from "@/components/mds/private-common";
import {
  OrganizationDetail,
  organizationTypes,
  type OrganizationSummary,
  type OrganizationType,
} from "@/components/mds/private-organization";
import "@/components/mds/private.css";

export default function Professional() {
  const auth = useAuth();
  return (
    <main
      className="page-shell private-workspace"
      style={{ paddingTop: 40, paddingBottom: 64 }}
    >
      <header className="section-heading" style={{ marginBottom: 32 }}>
        <span className="eyebrow">MDS · Professionnels</span>
        <h1 className="page-title">
          Vos sites. Vos dossiers.
          <br />
          Un seul interlocuteur.
        </h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          Entreprises, syndics, bailleurs, gestionnaires, associations et
          collectivités : regroupez vos demandes et vos documents dans un espace
          privé partagé avec vos contacts autorisés.
        </p>
      </header>
      {auth.loading ? (
        <QueryState loading />
      ) : auth.error ? (
        <QueryState error={auth.error} retry={auth.refresh} />
      ) : auth.user ? (
        <ProfessionalWorkspace currentUserId={auth.user.id} />
      ) : (
        <ProfessionalLanding />
      )}
    </main>
  );
}
function ProfessionalLanding() {
  return (
    <div className="stack">
      <section className="panel stack" style={{ maxWidth: 780 }}>
        <h2>Un espace réellement privé</h2>
        <p>
          Connectez-vous avec votre compte Manus pour créer votre organisation
          ou rejoindre celle qui vous a invité. Aucun compte ni dossier de
          démonstration ne remplace vos données.
        </p>
        <LoginButton />
        <p className="muted">
          Le créateur de l’organisation dispose des droits de gestion. Les accès
          des collaborateurs sont accordés par invitation, jamais par choix de
          rôle à la connexion.
        </p>
      </section>
      <section
        className="form-grid"
        aria-label="Fonctions de l’espace professionnel"
      >
        <article className="panel stack">
          <Building2 size={24} aria-hidden="true" />
          <h3>Plusieurs lieux</h3>
          <p className="muted">
            Enregistrez vos sites et leurs contacts sur place pour déclarer au
            bon endroit.
          </p>
        </article>
        <article className="panel stack">
          <Users size={24} aria-hidden="true" />
          <h3>Les bons contacts</h3>
          <p className="muted">
            Partagez un code d’invitation en privé. Aucun email n’est envoyé
            automatiquement.
          </p>
        </article>
        <article className="panel stack">
          <ShieldCheck size={24} aria-hidden="true" />
          <h3>Vos documents seulement</h3>
          <p className="muted">
            Consultez les interventions, devis, factures et contrats réellement
            rattachés à votre organisation.
          </p>
        </article>
      </section>
      <p className="notice">
        Pas encore de compte ? Vous pouvez aussi{" "}
        <a className="text-link" href="/demande">
          décrire un problème à MDS
        </a>{" "}
        sans compte. Le rattachement à une organisation nécessite une connexion
        et un accès autorisé.
      </p>
    </div>
  );
}
function ProfessionalWorkspace({ currentUserId }: { currentUserId: number }) {
  const organizations = trpc.mds.organizations.list.useQuery(undefined, {
    retry: false,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"create" | "join" | null>(null);
  const list = organizations.data ?? [];
  const selected = list.find(organization => organization.id === selectedId);
  async function onCreated(id: number) {
    setModal(null);
    await organizations.refetch();
    setSelectedId(id);
  }
  async function onJoined() {
    setModal(null);
    await organizations.refetch();
  }
  return (
    <div className="stack">
      <section className="panel stack">
        <div
          className="row"
          style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}
        >
          <div>
            <h2>Mes organisations</h2>
            <p className="muted">
              Accès vérifiés par le serveur à chaque dossier.
            </p>
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <ActionButton
              className="primary"
              onClick={() => setModal("create")}
            >
              <Plus size={17} aria-hidden="true" />
              Créer une organisation
            </ActionButton>
            <ActionButton onClick={() => setModal("join")}>
              <KeyRound size={17} aria-hidden="true" />
              Rejoindre par code
            </ActionButton>
          </div>
        </div>
        <QueryState
          loading={organizations.isLoading}
          error={organizations.error}
          retry={organizations.refetch}
          empty={
            !organizations.isLoading &&
            !organizations.error &&
            list.length === 0
          }
          emptyText="Vous n’appartenez encore à aucune organisation. Créez la vôtre ou utilisez un code d’invitation reçu."
        />
        {list.length > 0 && (
          <Field label="Choisir une organisation">
            <select
              value={selectedId ?? ""}
              onChange={e =>
                setSelectedId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Sélectionner une organisation</option>
              {list.map(organization => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} —{" "}
                  {organizationTypes.find(type => type.id === organization.type)
                    ?.name || organization.type}
                </option>
              ))}
            </select>
          </Field>
        )}
      </section>
      {selected ? (
        <OrganizationDetail
          key={selected.id}
          summary={selected}
          currentUserId={currentUserId}
        />
      ) : list.length > 0 && !organizations.error ? (
        <section className="panel empty">
          <Building2 size={28} aria-hidden="true" />
          <p>
            Choisissez une organisation pour consulter ses sites et ses
            interventions.
          </p>
        </section>
      ) : null}
      {modal === "create" && (
        <CreateOrganization
          onClose={() => setModal(null)}
          onCreated={onCreated}
        />
      )}
      {modal === "join" && (
        <JoinOrganization onClose={() => setModal(null)} onJoined={onJoined} />
      )}
    </div>
  );
}
function CreateOrganization({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<OrganizationType | "">("");
  const create = trpc.mds.organizations.create.useMutation({
    onSuccess: result => void onCreated(result.id),
  });
  return (
    <PrivateModal
      title="Créer mon organisation"
      description="Votre compte devient propriétaire avec les droits de gestion. Aucun autre utilisateur n’obtient d’accès automatiquement."
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          if (type) create.mutate({ name: name.trim(), type });
        }}
      >
        <Field label="Nom de l’organisation">
          <input
            required
            minLength={2}
            maxLength={200}
            autoComplete="organization"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>
        <Field label="Type d’organisation">
          <select
            required
            value={type}
            onChange={e => setType(e.target.value as OrganizationType)}
          >
            <option value="">Choisir un type</option>
            {organizationTypes.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <ErrorNotice error={create.error} />
        <ActionButton
          type="submit"
          className="primary"
          disabled={create.isPending}
        >
          {create.isPending ? "Création…" : "Créer mon organisation"}
        </ActionButton>
      </form>
    </PrivateModal>
  );
}
function JoinOrganization({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const join = trpc.mds.organizations.join.useMutation({
    onSuccess: () => {
      setCode("");
      void onJoined();
    },
  });
  return (
    <PrivateModal
      title="Rejoindre une organisation"
      description="Utilisez le code partagé par un gestionnaire et connectez-vous avec l’email auquel l’invitation a été adressée."
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          join.mutate({ code: code.trim() });
        }}
      >
        <Field label="Code d’invitation privé">
          <input
            required
            type="password"
            value={code}
            autoComplete="off"
            pattern="[a-f0-9]{64}"
            minLength={64}
            maxLength={64}
            title="Code privé de 64 caractères partagé par un gestionnaire"
            onChange={e => setCode(e.target.value)}
          />
        </Field>
        <p className="muted">
          Les droits sont ceux de l’invitation et sont vérifiés par le serveur.
        </p>
        <ErrorNotice error={join.error} />
        <ActionButton
          type="submit"
          className="primary"
          disabled={join.isPending || !code.trim()}
        >
          {join.isPending ? "Vérification…" : "Rejoindre l’organisation"}
        </ActionButton>
      </form>
    </PrivateModal>
  );
}
