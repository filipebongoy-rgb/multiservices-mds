import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleHelp,
  Clock,
  Droplets,
  FileText,
  Flame,
  House,
  MapPin,
  Paintbrush,
  Phone,
  Search,
  ShieldCheck,
  ThumbsUp,
  Wrench,
  Zap,
} from "lucide-react";
import { trades } from "@shared/mds";
import { ActiveRequestBanner } from "@/components/mds/ActiveRequestBanner";

const icons = [Droplets, Zap, Flame, Paintbrush, Wrench];

export default function Home() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filteredTrades = normalized
    ? trades.filter(
        trade =>
          trade.name.toLowerCase().includes(normalized) ||
          trade.short.toLowerCase().includes(normalized) ||
          trade.services.some(s => s.toLowerCase().includes(normalized))
      )
    : trades;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) return;
    const match = trades.find(
      trade =>
        trade.name.toLowerCase().includes(normalized) ||
        trade.short.toLowerCase().includes(normalized)
    );
    if (match) setLocation(`/demande?metier=${match.slug}`);
    else setLocation("/demande?libre=1");
  }

  return (
    <main id="main-content" className="simple-home page-shell">
      <ActiveRequestBanner />

      {/* Hero inspiré Uber Eats : photo réelle, bandeau orange, CTA clair */}
      <section className="simple-home-intro" aria-labelledby="home-title">
        <figure className="simple-hero">
          <img
            src="/hero-artisan.webp"
            srcSet="/hero-artisan-700.webp 700w, /hero-artisan.webp 1387w"
            sizes="(max-width: 700px) 100vw, 600px"
            alt="Photo réelle d'un artisan MDS en intervention"
            loading="eager"
          />
          <div className="simple-hero-copy">
            <span
              className="eyebrow"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              DÉPANNAGE &amp; PETITS TRAVAUX · RENNES + 30 KM
            </span>
            <h1 id="home-title">
              Un seul interlocuteur.{" "}
              <span className="home-title-rest">Tous vos travaux.</span>
            </h1>
            <p className="home-lead">
              Plomberie, électricité, chauffage, peinture et petits travaux à
              Rennes et ses alentours.{" "}
              <strong>Votre confort, notre priorité !</strong>
            </p>
            <div className="home-trust-chips" aria-label="Engagements clés">
              <span className="badge home-trust-chip">
                <CheckCircle2 size={14} aria-hidden="true" /> Fiable
              </span>
              <span className="badge home-trust-chip">
                <Clock size={14} aria-hidden="true" /> Rapide
              </span>
              <span className="badge home-trust-chip">
                <MapPin size={14} aria-hidden="true" /> À proximité
              </span>
              <span className="badge home-trust-chip">
                <ShieldCheck size={14} aria-hidden="true" /> 1 seul artisan
              </span>
            </div>
            <div
              className="row"
              style={{ marginTop: 14, flexWrap: "wrap", gap: 10 }}
            >
              <Link href="/demande" className="btn primary">
                Demander un devis gratuit
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </figure>

        {/* Adresse de référence façon Uber Eats */}
        <div className="home-location-bar">
          <MapPin size={18} color="#bc4c23" aria-hidden="true" />
          <span>
            Zone d’intervention : <strong>Rennes et son agglomération</strong> —
            jusqu’à 30 km
          </span>
        </div>

        {/* Barre de recherche de service */}
        <form className="home-search-bar" onSubmit={handleSearch} role="search">
          <Search size={20} color="#7a7872" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un service, un problème (fuite, disjoncteur, peinture…)"
            aria-label="Rechercher un service"
          />
          <button type="submit" className="home-search-btn">
            Chercher
          </button>
        </form>

        {/* Sélecteur d'espace — les deux accès sont strictement séparés */}
        <div className="home-access" aria-label="Choisir un espace">
          <Link className="home-access-card active" href="/demande">
            <House size={27} strokeWidth={1.7} aria-hidden="true" />
            <strong>Particulier</strong>
            <span>Pour votre domicile</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className="home-access-card" href="/professionnels">
            <Building2 size={27} strokeWidth={1.7} aria-hidden="true" />
            <strong>Professionnel</strong>
            <span>
              Mairie, HLM, syndic, hôpital, école, centre commercial · Contrats
              mensuels ou annuels
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Catégories populaires façon Uber Eats */}
      <section
        className="simple-services"
        aria-labelledby="home-services-title"
      >
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "baseline" }}
        >
          <h2 id="home-services-title">Catégories populaires</h2>
          <span className="muted small-text">
            5 corps de métier disponibles
          </span>
        </div>
        <div className="simple-trades">
          {filteredTrades.map(trade => {
            const originalIndex = trades.findIndex(t => t.slug === trade.slug);
            const Icon = icons[originalIndex];
            return (
              <Link
                key={trade.slug}
                href={`/demande?metier=${trade.slug}`}
                className="simple-trade"
              >
                <Icon size={25} strokeWidth={1.7} aria-hidden="true" />
                <span>{trade.name}</span>
                <small className="simple-trade-hint">{trade.short}</small>
              </Link>
            );
          })}
          <Link href="/demande?libre=1" className="simple-trade simple-other">
            <CircleHelp size={25} strokeWidth={1.7} aria-hidden="true" />
            <span>Autre problème</span>
            <small className="simple-trade-hint">
              décrivez votre problème librement
            </small>
          </Link>
        </div>
        {query && filteredTrades.length === 0 && (
          <p className="muted small-text" style={{ marginTop: 8 }}>
            Aucun métier ne correspond exactement. Utilisez{" "}
            <Link href="/demande?libre=1" className="text-link">
              « Autre problème »
            </Link>{" "}
            pour décrire votre besoin en texte libre.
          </p>
        )}
      </section>

      {/* Engagements confiance */}
      <section className="home-guarantees" aria-label="Engagements MDS">
        <div className="home-guarantee">
          <Clock
            size={24}
            strokeWidth={1.8}
            aria-hidden="true"
            color="#bc4c23"
          />
          <strong>Intervention rapide</strong>
          <span>Rennes et alentours</span>
        </div>
        <div className="home-guarantee">
          <ThumbsUp
            size={24}
            strokeWidth={1.8}
            aria-hidden="true"
            color="#bc4c23"
          />
          <strong>Travail soigné</strong>
          <span>et garanti</span>
        </div>
        <div className="home-guarantee">
          <FileText
            size={24}
            strokeWidth={1.8}
            aria-hidden="true"
            color="#bc4c23"
          />
          <strong>Devis gratuit</strong>
          <span>et sans engagement</span>
        </div>
        <div className="home-guarantee">
          <ShieldCheck
            size={24}
            strokeWidth={1.8}
            aria-hidden="true"
            color="#bc4c23"
          />
          <strong>Garantie décennale</strong>
          <span>assurance pro</span>
        </div>
      </section>

      {/* Appel d'urgence */}
      <section className="home-phone-cta">
        <span>Une urgence ? Un seul pro pour tous vos travaux :</span>
        <a href="tel:0604159916">
          <Phone size={18} aria-hidden="true" /> 06 04 15 99 16
        </a>
      </section>

      {/* Espace professionnel — contrat d'entretien & abonnement */}
      <section className="simple-home-pro" aria-label="Espace professionnel">
        <Link href="/professionnels" className="home-professional-link">
          <strong>
            Espace professionnel — mairie, HLM, syndic, bailleur, hôpital,
            école, commerce, entreprise
          </strong>
          <span>
            Contrats d’entretien sous forme d’abonnement mensuel ou annuel,
            tarifs adaptés et réduction annuelle pour vos parcs de bâtiments.
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>

      {/* Entrée artisan discrète — aucun risque de confusion avec l'espace pro */}
      <section className="simple-home-artisan" aria-label="Espace artisan">
        <Link href="/artisan" className="home-artisan-link">
          <strong>Accès réservé : vous êtes l’artisan MDS ?</strong>
          <span>
            Accéder à votre atelier : demandes, planning, interventions.
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
