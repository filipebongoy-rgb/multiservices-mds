import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${inverse ? "inverse" : ""}`}
      aria-label="MULTISERVICES MDS — accueil"
    >
      <span className="brand-mark brand-monogram" aria-hidden="true">
        MDS
      </span>
      <span>
        <strong>MDS</strong>
        <small>DÉPANNAGE &amp; PETITS TRAVAUX</small>
      </span>
    </Link>
  );
}

export function Header() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [error, setError] = useState("");
  const privateWorkspace =
    !!user && ["/artisan", "/professionnels"].includes(location);

  async function accountAction() {
    try {
      setError("");
      if (user) await logout();
      else startLogin();
    } catch {
      setError("Connexion indisponible. Veuillez réessayer.");
    }
  }

  const spaces = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="simple-nav-link"
          aria-label={
            privateWorkspace ? "Ouvrir mon compte" : "Choisir un espace"
          }
        >
          {privateWorkspace ? "Mon compte" : "Espaces"}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="simple-space-menu">
        <DropdownMenuItem asChild>
          <Link href="/professionnels">Professionnel</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void accountAction()}>
          {user && <LogOut size={17} aria-hidden="true" />}
          {user ? "Se déconnecter" : "Se connecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>
      <header
        className={`site-header simple-header ${privateWorkspace ? "is-private" : ""}`}
      >
        <div className="header-inner">
          <Brand />
          <nav
            className="simple-primary-nav"
            aria-label={
              privateWorkspace
                ? "Compte et retour client"
                : "Navigation principale"
            }
          >
            {privateWorkspace ? (
              <Link href="/" className="simple-nav-link simple-client-return">
                <ArrowLeft size={17} aria-hidden="true" />
                Retour client
              </Link>
            ) : (
              <>
                <Link
                  href="/demande"
                  className={`simple-nav-link ${location === "/demande" ? "active" : ""}`}
                  aria-current={location === "/demande" ? "page" : undefined}
                >
                  Demander
                </Link>
                <Link
                  href="/suivi"
                  className={`simple-nav-link ${location === "/suivi" ? "active" : ""}`}
                  aria-current={location === "/suivi" ? "page" : undefined}
                >
                  Suivre
                </Link>
              </>
            )}
            {spaces}
          </nav>
        </div>
        {error && (
          <p className="simple-header-error" role="alert">
            {error}
          </p>
        )}
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="site-footer simple-footer">
      <div className="simple-footer-inner">
        <span>MULTISERVICES MDS</span>
        <nav aria-label="Informations légales">
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </nav>
      </div>
    </footer>
  );
}

export function FreeRequest() {
  return (
    <Link href="/demande?libre=1" className="free-request">
      <span className="help-icon">
        <CircleHelp size={23} aria-hidden="true" />
      </span>
      <span>
        <strong>Je ne trouve pas mon problème</strong>
      </span>
      <ArrowRight size={21} aria-hidden="true" />
    </Link>
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      Chargement de vos informations…
    </div>
  );
}
export function ApiError({
  message,
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  return (
    <div className="notice error-message" role="alert">
      <strong>Impossible de charger ces informations.</strong>
      <p>{message || "Veuillez réessayer dans un instant."}</p>
      {retry && (
        <button className="btn secondary" onClick={retry}>
          Réessayer
        </button>
      )}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <CircleHelp size={28} aria-hidden="true" />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
