import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  LockKeyhole,
  LogIn,
  Eye,
  EyeOff,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Field, ErrorNotice } from "@/components/mds/private-common";
import "@/components/mds/private.css";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/profil";
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    new URLSearchParams(window.location.search).get("reset") ? "reset" : "login"
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notice, setNotice] = useState("");
  const [accountType, setAccountType] = useState<"particular" | "professional">(
    "particular"
  );
  const [error, setError] = useState<unknown>(null);
  const params = new URLSearchParams(window.location.search);
  const returnTo = safeReturnTo(params.get("returnTo"));
  const resetToken = params.get("reset") || "";
  const utils = trpc.useUtils();
  const register = trpc.auth.registerLocal.useMutation({
    onSuccess: async user => {
      await utils.auth.me.invalidate();
      setLocation(
        user.role === "admin" && returnTo === "/profil" ? "/artisan" : returnTo
      );
    },
    onError: cause => setError(cause),
  });
  const login = trpc.auth.loginLocal.useMutation({
    onSuccess: async user => {
      await utils.auth.me.invalidate();
      setLocation(
        user.role === "admin" && returnTo === "/profil" ? "/artisan" : returnTo
      );
    },
    onError: cause => setError(cause),
  });
  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setNotice("Si cette adresse correspond à un compte local, un lien de réinitialisation vient d’être envoyé."),
    onError: cause => setError(cause),
  });
  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setNotice("Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.");
      setMode("login");
      setPassword("");
      setPasswordConfirmation("");
    },
    onError: cause => setError(cause),
  });
  const pending = register.isPending || login.isPending || requestReset.isPending || resetPassword.isPending;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice("");
    if (mode === "forgot") {
      requestReset.mutate({ email });
      return;
    }
    if (mode === "reset") {
      resetPassword.mutate({ token: resetToken, newPassword: password, passwordConfirmation });
      return;
    }
    if (mode === "register") {
      register.mutate({
        firstName,
        lastName,
        email,
        password,
        passwordConfirmation,
        accountType,
      });
    } else {
      login.mutate({ email, password });
    }
  }

  return (
    <main className="page-shell auth-page">
      <section className="auth-card panel stack">
        <Link href="/" className="auth-back">
          <ArrowLeft size={18} /> Accueil
        </Link>
        <div className="auth-heading">
          <span className="eyebrow">Compte MDS</span>
          <h1>
            {mode === "login"
              ? returnTo === "/artisan" ? "Accès artisan" : "Se connecter"
              : mode === "register" ? "Créer mon compte"
              : mode === "forgot" ? "Mot de passe oublié"
              : "Créer un nouveau mot de passe"}
          </h1>
          <p className="muted">
            {mode === "login"
              ? "Retrouvez vos demandes, paiements et informations au même endroit."
              : mode === "register"
                ? "Quelques informations suffisent. Votre mot de passe est protégé côté serveur."
                : mode === "forgot"
                  ? "Saisissez votre adresse e-mail. Nous vous enverrons un lien valable 30 minutes."
                  : "Choisissez un nouveau mot de passe de 10 caractères minimum."}
          </p>
        </div>
        {(mode === "login" || mode === "register") && <div className="auth-tabs" role="tablist" aria-label="Accès au compte">
          <button
            type="button"
            className={mode === "login" ? "is-active" : ""}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            <LogIn size={17} /> Se connecter
          </button>
          <button
            type="button"
            className={mode === "register" ? "is-active" : ""}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            <UserPlus size={17} /> Créer un compte
          </button>
        </div>}
        <form className="stack" onSubmit={submit}>
          {mode === "register" && (
            <div className="auth-name-grid">
              <Field label="Prénom">
                <input
                  value={firstName}
                  onChange={event => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  minLength={2}
                  maxLength={60}
                  required
                />
              </Field>
              <Field label="Nom">
                <input
                  value={lastName}
                  onChange={event => setLastName(event.target.value)}
                  autoComplete="family-name"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </Field>
            </div>
          )}
          {mode !== "reset" && <Field
            label="Adresse e-mail"
            hint={
              mode === "register"
                ? "Utilisez l’adresse qui doit recevoir les confirmations MDS."
                : "Utilisez l’adresse e-mail de votre compte MDS."
            }
          >
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={320}
              required
            />
          </Field>}
          {mode === "register" && (
            <fieldset className="auth-account-type">
              <legend>Votre espace</legend>
              <label
                className={accountType === "particular" ? "is-selected" : ""}
              >
                <input
                  type="radio"
                  name="accountType"
                  checked={accountType === "particular"}
                  onChange={() => setAccountType("particular")}
                />
                <span>
                  <strong>Particulier</strong>
                  <small>Demander et suivre une intervention</small>
                </span>
              </label>
              <label
                className={accountType === "professional" ? "is-selected" : ""}
              >
                <input
                  type="radio"
                  name="accountType"
                  checked={accountType === "professional"}
                  onChange={() => setAccountType("professional")}
                />
                <span>
                  <strong>Professionnel</strong>
                  <small>Gérer une entreprise, un site ou un contrat</small>
                </span>
              </label>
            </fieldset>
          )}
          {mode !== "forgot" && <Field
            label="Mot de passe"
            hint={mode === "register" || mode === "reset" ? "10 caractères minimum. Vous pouvez afficher le texte avant validation." : undefined}
          >
            <div className="auth-password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "login" ? 1 : 10}
                maxLength={200}
                required
              />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>}
          {(mode === "register" || mode === "reset") && (
            <Field
              label="Confirmer le mot de passe"
              hint="Saisissez exactement le même mot de passe."
            >
              <input
                type={showConfirmation ? "text" : "password"}
                value={passwordConfirmation}
                onChange={event => setPasswordConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                maxLength={200}
                required
                aria-invalid={
                  passwordConfirmation.length > 0 &&
                  password !== passwordConfirmation
                }
              />
              <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmation(value => !value)} aria-label={showConfirmation ? "Masquer la confirmation" : "Afficher la confirmation"}>
                {showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </Field>
          )}
          {(mode === "register" || mode === "reset") &&
            passwordConfirmation.length > 0 &&
            password !== passwordConfirmation && (
              <p className="error-message" role="alert">
                Les deux mots de passe doivent être identiques.
              </p>
            )}
          {mode === "forgot" && (
            <p className="muted small-text">Le message de confirmation sera identique que l’adresse existe ou non.</p>
          )}
          <ErrorNotice error={error} />
          {notice && <p className="success-message" role="status">{notice}</p>}
          <button
            type="submit"
            className="btn primary auth-submit"
            disabled={
              pending ||
              ((mode === "register" || mode === "reset") &&
                ((mode === "register" && !email.trim()) ||
                  (mode === "reset" && !resetToken) ||
                  password.length < 10 ||
                  password !== passwordConfirmation))
            }
          >
            {pending
              ? "Traitement…"
              : mode === "login" ? "Ouvrir mon espace"
              : mode === "register" ? "Créer mon compte"
              : mode === "forgot" ? "Recevoir le lien"
              : "Enregistrer le nouveau mot de passe"}
          </button>
        </form>
        {mode === "login" && <button type="button" className="auth-text-link" onClick={() => { setMode("forgot"); setError(null); setNotice(""); }}>
          Mot de passe oublié ?
        </button>}
        {(mode === "forgot" || mode === "reset") && <button type="button" className="auth-text-link" onClick={() => { setMode("login"); setError(null); setNotice(""); }}>
          Retour à la connexion
        </button>}
        <div className="auth-security-note">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            Votre mot de passe n’est jamais affiché ni stocké en clair.
          </span>
          <LockKeyhole size={18} aria-hidden="true" />
        </div>
        <details className="auth-existing-login">
          <summary>Accès gestionnaire MDS existant</summary>
          <p className="small-text muted">
            Cette connexion est conservée pour le compte administrateur/artisan
            MDS. Google sera ajouté ultérieurement.
          </p>
          <button
            type="button"
            className="btn secondary"
            onClick={() => startLogin()}
          >
            Se connecter avec Manus
          </button>
        </details>
      </section>
    </main>
  );
}
