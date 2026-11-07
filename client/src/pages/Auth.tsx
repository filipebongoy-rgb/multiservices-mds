import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  LockKeyhole,
  LogIn,
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [accountType, setAccountType] = useState<"particular" | "professional">(
    "particular"
  );
  const [error, setError] = useState<unknown>(null);
  const params = new URLSearchParams(window.location.search);
  const returnTo = safeReturnTo(params.get("returnTo"));
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
  const pending = register.isPending || login.isPending;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
          <h1>{mode === "login" ? "Se connecter" : "Créer mon compte"}</h1>
          <p className="muted">
            {mode === "login"
              ? "Retrouvez vos demandes, paiements et informations au même endroit."
              : "Quelques informations suffisent. Votre mot de passe est protégé côté serveur."}
          </p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Accès au compte">
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
        </div>
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
          <Field
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
          </Field>
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
          <Field
            label="Mot de passe"
            hint={
              mode === "register"
                ? "10 caractères minimum. Ne le partagez jamais."
                : undefined
            }
          >
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              minLength={mode === "register" ? 10 : 1}
              maxLength={200}
              required
            />
          </Field>
          {mode === "register" && (
            <Field
              label="Confirmer le mot de passe"
              hint="Saisissez exactement le même mot de passe."
            >
              <input
                type="password"
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
            </Field>
          )}
          {mode === "register" &&
            passwordConfirmation.length > 0 &&
            password !== passwordConfirmation && (
              <p className="error-message" role="alert">
                Les deux mots de passe doivent être identiques.
              </p>
            )}
          <ErrorNotice error={error} />
          <button
            type="submit"
            className="btn primary auth-submit"
            disabled={
              pending ||
              (mode === "register" &&
                (!email.trim() ||
                  password.length < 10 ||
                  password !== passwordConfirmation))
            }
          >
            {pending
              ? "Traitement…"
              : mode === "login"
                ? "Ouvrir mon espace"
                : "Créer mon compte"}
          </button>
        </form>
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
