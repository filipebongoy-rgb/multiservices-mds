import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  LogOut,
  CalendarDays,
  FileText,
  House,
  UserRound,
  Wrench,
} from "lucide-react";
import { HeaderCallButton, NotificationBell } from "./HeaderActions";
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
      <img
        className="brand-logo"
        src="/mds-logo.svg"
        alt="MDS Multiservices — dépannage et petits travaux"
      />
    </Link>
  );
}

export function Header() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [error, setError] = useState("");
  const privateWorkspace =
    !!user && ["/artisan", "/professionnels"].includes(location);
  const requestPage = location === "/demande";

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
          <Link
            href="/artisan"
            className={
              user?.role === "admin" ? "simple-artisan-item" : undefined
            }
          >
            Espace artisan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/professionnels">Professionnel</Link>
        </DropdownMenuItem>
        {user && (
          <DropdownMenuItem asChild>
            <Link href="/profil">Mon profil</Link>
          </DropdownMenuItem>
        )}
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
        className={`site-header simple-header ${privateWorkspace ? "is-private" : ""} ${requestPage ? "is-request" : ""}`}
      >
        <div className="header-inner">
          {requestPage && (
            <Link
              href="/"
              className="simple-request-back"
              aria-label="Retour à l’accueil"
            >
              <ArrowLeft size={24} aria-hidden="true" />
            </Link>
          )}
          <Brand />
          {requestPage && (
            <strong className="simple-request-title">
              Demande d’intervention
            </strong>
          )}
          {!requestPage && (
            <div className="header-quick-actions">
              <NotificationBell />
              {!privateWorkspace && <HeaderCallButton />}
            </div>
          )}
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
                {user?.role === "admin" && (
                  <Link
                    href="/artisan"
                    className={`simple-nav-link simple-artisan-nav ${location === "/artisan" ? "active" : ""}`}
                    aria-current={location === "/artisan" ? "page" : undefined}
                  >
                    Artisan
                  </Link>
                )}
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
  const [location] = useLocation();
  if (location === "/artisan" || location === "/professionnels") return null;
  return (
    <footer className="site-footer simple-footer">
      <div className="simple-footer-inner">
        <div className="simple-footer-brand-block">
          <span className="simple-footer-name">
            MULTISERVICES MDS — Rennes et alentours
          </span>
          <span className="simple-footer-tagline">
            La qualité au service de votre confort ! · 06 04 15 99 16
          </span>
        </div>
        <nav aria-label="Informations légales">
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/artisan" className="simple-footer-artisan">
            Accès artisan
          </Link>
        </nav>
      </div>
    </footer>
  );
}
export function MobileBottomNav() {
  const [location] = useLocation();
  if (location === "/artisan" || location === "/professionnels") return null;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const items = [
    { href: "/", label: "Accueil", Icon: House },
    { href: "/suivi", label: "Mes demandes", Icon: CalendarDays },
    { href: "/paiements", label: "Mes documents", Icon: FileText },
    isAdmin
      ? { href: "/artisan", label: "Artisan", Icon: Wrench }
      : { href: "/profil", label: "Mon espace", Icon: UserRound },
  ];
  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
      {items.map(({ href, label, Icon }) => {
        const active = href === "/" ? location === "/" : location === href;
        return (
          <Link
            key={href}
            href={href}
            className={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.4 : 1.8}
              aria-hidden="true"
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
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
