import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  Menu,
  X,
  ArrowRight,
  CircleHelp,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${inverse ? "inverse" : ""}`}
      aria-label="MULTISERVICES MDS — accueil"
    >
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="M7 29V13l8 7 5-9 5 9 8-7v16M7 29h26"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="miter"
          />
        </svg>
      </span>
      <span>
        <strong>
          MDS<span className="brand-dot">.</span>
        </strong>
        <small>MULTISERVICES</small>
      </span>
    </Link>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Navigation principale">
            <Link className={location === "/" ? "active" : ""} href="/">
              Particuliers
            </Link>
            <Link
              className={location === "/professionnels" ? "active" : ""}
              href="/professionnels"
            >
              Professionnels
              <ArrowUpRight size={14} />
            </Link>
            <Link href="/suivi">Suivre ma demande</Link>
          </nav>
          <div className="header-actions">
            {user ? (
              <button
                className="login-link"
                onClick={() => logout()}
                aria-label="Se déconnecter"
              >
                <LogOut size={16} />
                <span>Déconnexion</span>
              </button>
            ) : (
              <button className="login-link" onClick={() => startLogin()}>
                Mon espace
              </button>
            )}
            <Link href="/demande" className="btn primary small">
              Prendre rendez-vous
              <ArrowUpRight size={16} />
            </Link>
            <button
              className="menu-button"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            className="mobile-nav"
            aria-label="Navigation mobile"
            onClick={() => setOpen(false)}
          >
            <Link href="/">Particuliers</Link>
            <Link href="/professionnels">Professionnels</Link>
            <Link href="/prestations">Les métiers</Link>
            <Link href="/suivi">Suivre ma demande</Link>
            <Link href="/artisan">Espace artisan</Link>
          </nav>
        )}
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Brand inverse />
        <p>
          Réparations, travaux et maintenance.
          <br />
          Un seul interlocuteur, du besoin à l’intervention.
        </p>
        <nav aria-label="Liens de pied de page">
          <Link href="/artisan">
            Espace artisan
            <ArrowUpRight size={13} />
          </Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>MULTISERVICES MDS</span>
        <span>Fait pour vous simplifier les travaux.</span>
      </div>
    </footer>
  );
}
export function FreeRequest() {
  return (
    <Link href="/demande" className="free-request">
      <span className="help-icon">
        <CircleHelp size={23} />
      </span>
      <span>
        <strong>Je ne trouve pas mon problème</strong>
        <small>Décrivez votre besoin avec vos mots.</small>
      </span>
      <ArrowRight size={21} />
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
      <CircleHelp size={28} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
