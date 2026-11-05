import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  CircleHelp,
  Droplets,
  Flame,
  Paintbrush,
  House,
  Wrench,
  Zap,
} from "lucide-react";
import { trades } from "@shared/mds";
import { ActiveRequestBanner } from "@/components/mds/ActiveRequestBanner";

const icons = [Droplets, Zap, Flame, Paintbrush, Wrench];

export default function Home() {
  return (
    <main id="main-content" className="simple-home page-shell">
      <ActiveRequestBanner />
      <section className="simple-home-intro" aria-labelledby="home-title">
        <figure className="simple-hero">
          <img
            src="/manus-storage/async-images/jrMWVnVL5iHffqpYfhEc1x/image-1.webp"
            alt="Photo illustrative d’un artisan en intervention devant une habitation"
          />
          <div className="simple-hero-copy">
            <h1 id="home-title">
              Un problème <span className="home-title-rest">chez vous ?</span>
            </h1>
            <p className="home-lead">
              Nous nous occupons de vos travaux et dépannages.
            </p>
          </div>
        </figure>
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
            <span>Entreprise, mairie, HLM, syndic…</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section
        className="simple-services"
        aria-labelledby="home-services-title"
      >
        <h2 id="home-services-title">Que souhaitez-vous faire réparer ?</h2>
        <div className="simple-trades">
          {trades.map((trade, index) => {
            const Icon = icons[index];
            return (
              <Link
                key={trade.slug}
                href={`/demande?metier=${trade.slug}`}
                className="simple-trade"
              >
                <Icon size={25} strokeWidth={1.7} aria-hidden="true" />
                <span>{trade.name}</span>
              </Link>
            );
          })}
          <Link href="/demande?libre=1" className="simple-trade simple-other">
            <CircleHelp size={25} strokeWidth={1.7} aria-hidden="true" />
            <span>Autre besoin</span>
          </Link>
        </div>
      </section>
      <section className="simple-home-pro" aria-label="Espace professionnel">
        <Link href="/professionnels" className="home-professional-link">
          <strong>Vous êtes une entreprise ou une collectivité ?</strong>
          <span>Gérer vos bâtiments et vos interventions avec MDS.</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
      <footer className="home-footer" aria-label="Pied de page">
        <p className="home-footer-brand">MULTISERVICES MDS</p>
        <div className="home-footer-links">
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </div>
      </footer>
    </main>
  );
}
