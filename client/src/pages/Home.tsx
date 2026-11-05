import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  CircleHelp,
  Droplets,
  Zap,
  Flame,
  Paintbrush,
  Wrench,
} from "lucide-react";
import { trades } from "@shared/mds";

const icons = [Droplets, Zap, Flame, Paintbrush, Wrench];
const draftKey = "mds-request-draft";

function readDraft(): Record<string, unknown> {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(draftKey) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? (saved as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export default function Home() {
  const [description, setDescription] = useState(() => {
    const saved = readDraft();
    return typeof saved.description === "string" ? saved.description : "";
  });
  const [error, setError] = useState("");
  const [, navigate] = useLocation();

  function persistDescription(value: string) {
    const saved = readDraft();
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({
        ...saved,
        description: value,
        key:
          typeof saved.key === "string" && saved.key.length >= 16
            ? saved.key
            : crypto.randomUUID(),
      })
    );
  }

  function continueRequest(descriptionReady = false) {
    if (descriptionReady && description.trim().length < 10) {
      setError("Décrivez votre problème en au moins 10 caractères.");
      return;
    }
    try {
      persistDescription(description);
      if (descriptionReady)
        sessionStorage.setItem("mds-description-ready", "1");
      else sessionStorage.removeItem("mds-description-ready");
      setError("");
      navigate("/demande");
    } catch {
      setError(
        "Votre description est conservée ici. Autorisez le stockage de cette session, puis réessayez."
      );
    }
  }

  return (
    <main id="main-content" className="simple-home page-shell">
      <section className="simple-home-intro" aria-labelledby="home-title">
        <h1 id="home-title">
          Un problème chez vous ? <span>On s’en occupe.</span>
        </h1>
        <form
          className="simple-description-form"
          onSubmit={event => {
            event.preventDefault();
            continueRequest(true);
          }}
        >
          <label htmlFor="home-description">Décrivez votre problème</label>
          <p className="action-example">
            Exemple : « Une prise ne fonctionne plus dans la cuisine. »
          </p>
          <textarea
            id="home-description"
            name="description"
            rows={3}
            maxLength={5000}
            required
            minLength={10}
            value={description}
            placeholder="Une fuite, une prise, un mur à repeindre…"
            aria-describedby={error ? "home-draft-error" : undefined}
            aria-invalid={error ? true : undefined}
            onChange={event => {
              const value = event.target.value;
              setDescription(value);
              try {
                persistDescription(value);
                setError("");
              } catch {
                // Le champ reste éditable même si le navigateur refuse le stockage.
              }
            }}
          />
          {error && (
            <p id="home-draft-error" className="error-message" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn primary simple-continue">
            Continuer <ArrowRight size={20} aria-hidden="true" />
          </button>
        </form>
      </section>
      <section
        className="simple-services"
        aria-labelledby="home-services-title"
      >
        <h2 id="home-services-title">Choisissez un service</h2>
        <p className="action-example">
          Exemple : choisissez Plomberie pour une fuite ou Électricité pour une
          panne.
        </p>
        <div className="simple-trades">
          {trades.map((trade, index) => {
            const Icon = icons[index];
            return (
              <Link
                key={trade.slug}
                href={`/prestations?metier=${trade.slug}`}
                className="simple-trade"
                onClick={event => {
                  if (!description) return;
                  try {
                    persistDescription(description);
                    sessionStorage.removeItem("mds-description-ready");
                  } catch {
                    event.preventDefault();
                    setError(
                      "Votre description est conservée ici. Autorisez le stockage de cette session, puis réessayez."
                    );
                  }
                }}
              >
                <Icon size={25} strokeWidth={1.7} aria-hidden="true" />
                <span>{trade.name}</span>
              </Link>
            );
          })}
        </div>
        <Link
          href="/demande?libre=1"
          className="simple-free-request"
          onClick={event => {
            event.preventDefault();
            continueRequest();
          }}
        >
          <CircleHelp size={21} aria-hidden="true" />
          Je ne trouve pas mon problème
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
