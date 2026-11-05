import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";
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
  type OrganizationType,
} from "@/components/mds/private-organization";
import "@/components/mds/private.css";

export default function Professional() {
  const auth = useAuth();
  return (
    <main id="main-content" className="page-shell private-workspace simple-pro">
      <header className="simple-pro-header">
        <span className="eyebrow">Espace professionnel</span>
        <h1>Déclarer un problème. Suivre sa résolution.</h1>
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
    <section className="panel stack" style={{ maxWidth: 640 }}>
      <h2 className="simple-panel-title">Vos bâtiments et vos demandes</h2>
      <p>Connectez-vous pour retrouver votre organisation ou en créer une.</p>
      <LoginButton />
    </section>
  );
}

function ProfessionalWorkspace({ currentUserId }: { currentUserId: number }) {
  const organizations = trpc.mds.organizations.list.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"create" | "join" | null>(null);
  const list = organizations.data ?? [];
  const selected =
    list.find(organization => organization.id === selectedId) || list[0];

  async function onCreated(id: number) {
    setModal(null);
    await organizations.refetch();
    setSelectedId(id);
  }
  async function onJoined() {
    setModal(null);
    await organizations.refetch();
  }

  const setupActions = (
    <div className="row" style={{ flexWrap: "wrap" }}>
      <ActionButton
        className={list.length ? "secondary" : "primary"}
        onClick={() => setModal("create")}
      >
        <Plus size={18} aria-hidden="true" />
        Créer une organisation
      </ActionButton>
      <ActionButton onClick={() => setModal("join")}>
        <KeyRound size={18} aria-hidden="true" />
        Rejoindre par code
      </ActionButton>
    </div>
  );

  return (
    <div className="stack">
      <QueryState
        loading={organizations.isLoading}
        error={organizations.error}
        retry={organizations.refetch}
      />
      {!organizations.isLoading && !organizations.error && (
        <>
          {selected ? (
            <>
              <div className="simple-pro-context">
                <Field label="Organisation">
                  <select
                    value={selected.id}
                    onChange={event =>
                      setSelectedId(Number(event.target.value))
                    }
                  >
                    {list.map(organization => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <span className="badge">
                  {selected.role === "owner"
                    ? "Propriétaire"
                    : selected.role === "manager"
                      ? "Gestionnaire"
                      : "Collaborateur"}
                </span>
              </div>
              <OrganizationDetail
                key={selected.id}
                summary={selected}
                currentUserId={currentUserId}
              />
              <details className="simple-pro-setup">
                <summary>Gérer mes organisations</summary>
                {setupActions}
              </details>
            </>
          ) : (
            <section className="panel stack">
              <h2 className="simple-panel-title">
                Votre première organisation
              </h2>
              <p className="muted">
                Créez votre organisation ou utilisez le code d’invitation reçu.
              </p>
              {setupActions}
            </section>
          )}
        </>
      )}
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
      description="Vous disposerez des droits de gestion de cette organisation."
      onClose={onClose}
    >
      <form
        className="stack simple-pro-form"
        onSubmit={event => {
          event.preventDefault();
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
            onChange={event => setName(event.target.value)}
          />
        </Field>
        <Field label="Type d’organisation">
          <select
            required
            value={type}
            onChange={event => setType(event.target.value as OrganizationType)}
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
      description="Utilisez le code reçu et le compte correspondant à l’email invité."
      onClose={onClose}
    >
      <form
        className="stack simple-pro-form"
        onSubmit={event => {
          event.preventDefault();
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
            onChange={event => setCode(event.target.value)}
          />
        </Field>
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
