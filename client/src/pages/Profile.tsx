import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
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
  const [, setLocation] = useLocation();
  const profile = trpc.mds.profile.me.useQuery(undefined, {
    enabled: Boolean(auth.user),
    retry: false,
  });
  const organizations = trpc.mds.organizations.list.useQuery(undefined, {
    enabled: Boolean(auth.user),
    retry: false,
  });
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<"particular" | "professional">(
    auth.user?.accountType ?? "particular"
  );
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name ?? "");
    setEmail(profile.data.email ?? "");
    setAccountType(profile.data.accountType ?? "particular");
    setPhone(profile.data.phone ?? "");
    setAddress(profile.data.address ?? "");
    setPostcode(profile.data.postcode ?? "");
    setCity(profile.data.city ?? "");
  }, [profile.data]);

  const update = trpc.mds.profile.update.useMutation({
    onSuccess: async () => {
      setNotice("Vos informations ont été enregistrées.");
      await profile.refetch();
      await utils.auth.me.invalidate();
    },
  });
  const changePassword = trpc.mds.profile.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setNotice("Votre mot de passe a été modifié.");
    },
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      void auth.refresh();
      setLocation("/connexion");
    },
  });
  const deleteAccount = trpc.mds.profile.deleteAccount.useMutation({
    onSuccess: () => logout.mutate(),
  });

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
        <section className="panel stack profile-account-card">
          <span className="eyebrow">Mon compte</span>
          <h1>Gérez votre compte MDS</h1>
          <p>
            Connectez-vous pour modifier vos informations, retrouver vos
            demandes et gérer vos accès.
          </p>
          <LoginButton />
          <Link className="btn secondary" href="/demande">
            Faire une demande sans compte
          </Link>
        </section>
      </main>
    );
  }

  const isAdmin = auth.user.role === "admin";
  return (
    <main className="page-shell private-workspace profile-page">
      <header className="simple-pro-header profile-header">
        <span className="eyebrow">
          {isAdmin ? "Compte administrateur" : "Mon compte"}
        </span>
        <h1>Vos informations</h1>
        <p className="muted">
          Modifiez vos coordonnées, votre espace et vos accès depuis cette page.
        </p>
        <div className="profile-header-actions">
          {isAdmin && (
            <Link href="/artisan" className="btn primary">
              Ouvrir l’espace artisan
            </Link>
          )}
          <button
            type="button"
            className="btn secondary"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </header>

      <div className="profile-grid">
        <section className="panel stack">
          <div>
            <span className="eyebrow">Profil public</span>
            <h2 className="simple-panel-title">Identité et coordonnées</h2>
            <p className="muted small-text">
              Ces informations peuvent être reprises dans vos demandes et vos
              contrats.
            </p>
          </div>
          <form
            className="stack"
            onSubmit={event => {
              event.preventDefault();
              setNotice(null);
              update.mutate({
                name: name.trim(),
                email: email.trim(),
                accountType,
                phone: phone.trim(),
                address: address.trim(),
                postcode: postcode.trim(),
                city: city.trim(),
              });
            }}
          >
            <Field label="Nom affiché">
              <input
                value={name}
                minLength={2}
                maxLength={120}
                required
                autoComplete="name"
                onChange={event => setName(event.target.value)}
              />
            </Field>
            <Field label="Adresse e-mail">
              <input
                type="email"
                value={email}
                maxLength={320}
                autoComplete="email"
                onChange={event => setEmail(event.target.value)}
              />
            </Field>
            <fieldset className="profile-account-type">
              <legend>Type d’espace</legend>
              <label
                className={accountType === "particular" ? "is-selected" : ""}
              >
                <input
                  type="radio"
                  checked={accountType === "particular"}
                  onChange={() => setAccountType("particular")}
                />
                <span>
                  <strong>Particulier</strong>
                  <small>Demandes et suivi personnels</small>
                </span>
              </label>
              <label
                className={accountType === "professional" ? "is-selected" : ""}
              >
                <input
                  type="radio"
                  checked={accountType === "professional"}
                  onChange={() => setAccountType("professional")}
                />
                <span>
                  <strong>Professionnel</strong>
                  <small>Entreprise, site ou contrat</small>
                </span>
              </label>
            </fieldset>
            <div className="profile-form-grid">
              <Field label="Téléphone">
                <input
                  value={phone}
                  maxLength={30}
                  autoComplete="tel"
                  onChange={event => setPhone(event.target.value)}
                />
              </Field>
              <Field label="Ville">
                <input
                  value={city}
                  maxLength={120}
                  autoComplete="address-level2"
                  onChange={event => setCity(event.target.value)}
                />
              </Field>
            </div>
            <div className="profile-form-grid">
              <Field label="Code postal">
                <input
                  value={postcode}
                  maxLength={12}
                  autoComplete="postal-code"
                  onChange={event => setPostcode(event.target.value)}
                />
              </Field>
              <Field label="Adresse">
                <input
                  value={address}
                  maxLength={500}
                  autoComplete="street-address"
                  onChange={event => setAddress(event.target.value)}
                />
              </Field>
            </div>
            <ErrorNotice error={update.error} />
            {notice && (
              <p className="success-message" role="status">
                {notice}
              </p>
            )}
            <ActionButton
              className="primary"
              type="submit"
              disabled={update.isPending || name.trim().length < 2}
            >
              {update.isPending
                ? "Enregistrement…"
                : "Enregistrer mes informations"}
            </ActionButton>
          </form>
        </section>

        <div className="stack">
          <section className="panel stack">
            <span className="eyebrow">Sécurité</span>
            <h2 className="simple-panel-title">Modifier le mot de passe</h2>
            <p className="muted small-text">
              Disponible pour les comptes créés avec MDS. Les comptes
              Manus/OAuth conservent leur connexion externe.
            </p>
            <form
              className="stack"
              onSubmit={event => {
                event.preventDefault();
                changePassword.mutate({ currentPassword, newPassword });
              }}
            >
              <Field label="Mot de passe actuel">
                <input
                  type="password"
                  value={currentPassword}
                  autoComplete="current-password"
                  required
                  onChange={event => setCurrentPassword(event.target.value)}
                />
              </Field>
              <Field label="Nouveau mot de passe" hint="10 caractères minimum.">
                <input
                  type="password"
                  value={newPassword}
                  minLength={10}
                  autoComplete="new-password"
                  required
                  onChange={event => setNewPassword(event.target.value)}
                />
              </Field>
              <ErrorNotice error={changePassword.error} />
              <ActionButton
                className="secondary"
                type="submit"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending
                  ? "Modification…"
                  : "Modifier le mot de passe"}
              </ActionButton>
            </form>
          </section>

          <section className="panel stack">
            <span className="eyebrow">Compte</span>
            <h2 className="simple-panel-title">Supprimer mon compte</h2>
            <p className="muted small-text">
              La suppression anonymise vos données personnelles et conserve
              uniquement les éléments nécessaires à l’historique légal des
              demandes et paiements.
            </p>
            {isAdmin && (
              <p className="warning-message">
                Le compte administrateur propriétaire ne peut pas être supprimé
                ici. Un autre administrateur doit d’abord reprendre
                officiellement cet accès.
              </p>
            )}
            <details>
              <summary>Afficher la zone de suppression</summary>
              <form
                className="stack profile-danger-zone"
                onSubmit={event => {
                  event.preventDefault();
                  deleteAccount.mutate({ confirmation: "SUPPRIMER" });
                }}
              >
                <Field label="Écrivez « SUPPRIMER » pour confirmer">
                  <input
                    value={confirmation}
                    autoComplete="off"
                    required
                    onChange={event => setConfirmation(event.target.value)}
                  />
                </Field>
                <ErrorNotice error={deleteAccount.error} />
                <button
                  type="submit"
                  className="btn danger"
                  disabled={
                    isAdmin ||
                    confirmation !== "SUPPRIMER" ||
                    deleteAccount.isPending
                  }
                >
                  {deleteAccount.isPending
                    ? "Suppression…"
                    : "Supprimer mon compte"}
                </button>
              </form>
            </details>
          </section>
        </div>
      </div>

      {!isAdmin && (
        <section className="panel stack profile-links-panel">
          <span className="eyebrow">Accès rapides</span>
          <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
            <Link href="/demande" className="btn primary">
              Faire une demande
            </Link>
            <Link href="/suivi" className="btn secondary">
              Voir mon suivi
            </Link>
            <Link href="/professionnels" className="btn secondary">
              Espace professionnel
            </Link>
          </div>
          {organizations.data?.length ? (
            <p className="muted small-text">
              Organisations accessibles :{" "}
              {organizations.data.map(org => org.name).join(", ")}.
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}
