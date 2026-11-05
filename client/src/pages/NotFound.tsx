import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CircleAlert, House, Wrench } from "lucide-react";

// Hosting answers this path with HTTP 404 while still serving the app.
const NOT_FOUND_PATH = "/404";

// Render for unknown routes and for items the server confirmed missing.
// The redirect is irreversible: never render while loading, on other errors, or before auth resolves.
export default function NotFound() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);

    // Full-page navigation: a client-side route change sends no request, so no 404 status.
    if (window.location.pathname.replace(/\/$/, "") !== NOT_FOUND_PATH) {
      window.location.replace(NOT_FOUND_PATH);
    }

    return () => robots.remove();
  }, []);

  return (
    <main className="page-shell">
      <section className="notfound-panel">
        <span className="notfound-code" aria-hidden="true">
          404
        </span>
        <div className="notfound-icon" aria-hidden="true">
          <CircleAlert size={44} />
        </div>
        <h1 className="notfound-title">Page introuvable</h1>
        <p className="notfound-text">
          La page demandée n’existe pas ou a été déplacée. Choisissez une
          direction pour continuer.
        </p>
        <div className="notfound-actions">
          <button
            type="button"
            className="notfound-btn notfound-btn-primary"
            onClick={() => setLocation("/")}
          >
            <House size={18} aria-hidden="true" /> Revenir à l’accueil
          </button>
          <Link
            href="/prestations"
            className="notfound-btn notfound-btn-secondary"
          >
            <Wrench size={18} aria-hidden="true" /> Voir nos prestations
          </Link>
        </div>
        <p className="notfound-footer">
          Besoin d’aide ? Appelez le <strong>06 04 15 99 16</strong>
        </p>
      </section>
    </main>
  );
}
