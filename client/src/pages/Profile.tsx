import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ActionButton,
  ErrorNotice,
  Field,
  LoginButton,
  QueryState,
} from "@/components/mds/private-common";
import "@/components/mds/private.css";

export default function Profile() {
  const auth = useAuth();
  const profile = trpc.mds.profile.me.useQuery(undefined, {
    enabled: Boolean(auth.user),
    retry: false,
  });
  const organizations = trpc.mds.organizations.list.useQuery(undefined, {
    enabled: Boolean(auth.user),
    retry: false,
  });
  const update = trpc.mds.profile.update.useMutation({
    onSuccess: () => void profile.refetch(),
  });
  const [name, setName] = useState<string | null>(null);

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
  if (!auth.user) {
    return (
      <main className="page-shell private-workspace">
        <section className="panel stack" style={{ maxWidth: 640 }}>
          <span className="eyebrow">Mon profil</span>
          <h1>Retrouvez vos informations MDS</h1>
          <p>
            Connectez-vous pour gérer votre identité et retrouver vos accès
            particuliers ou professionnels.
          </p>
          <LoginButton />
        </section>
      </main>
    );
  }

  const currentName = name ?? profile.data?.name ?? auth.user.name ?? "";
  return (
    <main className="page-shell private-workspace">
      <header className="simple-pro-header">
        <span className="eyebrow">Mon profil</span>
        <h1>Vos informations, au même endroit</h1>
        <p className="muted">
          Ces informations servent à vous reconnaître dans vos demandes et vos
          organisations.
        </p>
      </header>
      <div className="stack" style={{ maxWidth: 760 }}>
        <section className="panel stack">
          <h2 className="simple-panel-title">Informations personnelles</h2>
          <form
            className="stack"
            onSubmit={event => {
              event.preventDefault();
              update.mutate({ name: currentName.trim() });
            }}
          >
            <Field label="Nom affiché">
              <input
                value={currentName}
                minLength={2}
                maxLength={120}
                required
                autoComplete="name"
                onChange={event => setName(event.target.value)}
              />
            </Field>
            <Field label="Adresse e-mail">
              <input
                value={
                  profile.data?.email ?? auth.user.email ?? "Non communiquée"
                }
                readOnly
                aria-describedby="email-help"
              />
              <small id="email-help" className="muted">
                L’adresse de connexion est gérée par votre compte sécurisé.
              </small>
            </Field>
            <ErrorNotice error={update.error} />
            <ActionButton
              className="primary"
              type="submit"
              disabled={update.isPending || currentName.trim().length < 2}
            >
              {update.isPending
                ? "Enregistrement…"
                : "Enregistrer mes informations"}
            </ActionButton>
          </form>
        </section>
        <section className="panel stack">
          <h2 className="simple-panel-title">Mes espaces</h2>
          {organizations.isLoading ? (
            <QueryState loading />
          ) : organizations.error ? (
            <QueryState
              error={organizations.error}
              retry={organizations.refetch}
            />
          ) : organizations.data?.length ? (
            <>
              <p>Vous avez accès à ces organisations professionnelles :</p>
              <ul className="stack" style={{ paddingLeft: 20 }}>
                {organizations.data.map(org => (
                  <li key={org.id}>
                    <strong>{org.name}</strong> ·{" "}
                    {org.role === "owner"
                      ? "propriétaire"
                      : org.role === "manager"
                        ? "gestionnaire"
                        : "collaborateur"}
                  </li>
                ))}
              </ul>
              <Link href="/professionnels" className="button secondary">
                Gérer mes organisations
              </Link>
            </>
          ) : (
            <>
              <p>
                Vous utilisez actuellement l’espace particulier. Vous pouvez
                envoyer une demande sans créer de dossier administratif.
              </p>
              <Link href="/demande" className="button primary">
                Faire une demande
              </Link>
            </>
          )}
        </section>
        <section className="panel stack">
          <h2 className="simple-panel-title">Paiements et suivi</h2>
          <p>
            Retrouvez le prix accepté, le statut du paiement et les preuves de
            fin directement dans le suivi de chaque dossier.
          </p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Link href="/suivi" className="button primary">
              Voir mon suivi
            </Link>
            <Link href="/paiements" className="button secondary">
              Voir les paiements
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
