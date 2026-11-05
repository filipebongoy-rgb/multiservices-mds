import { Link } from "wouter";
import {
  ArrowRight,
  CircleHelp,
  Droplets,
  Flame,
  Paintbrush,
  Wrench,
  Zap,
} from "lucide-react";
import { trades } from "@shared/mds";

const icons = [Droplets, Zap, Flame, Paintbrush, Wrench];

export default function Home() {
  return (
    <main id="main-content" className="simple-home page-shell">
      <section className="simple-home-intro" aria-labelledby="home-title">
        <h1 id="home-title">
          Un problème <span className="home-title-rest">chez vous ?</span>
        </h1>
        <p className="home-lead">
          Nous nous occupons de vos travaux et dépannages.
        </p>
        <figure className="simple-hero">
          <img
            src="/manus-storage/async-images/jrMWVnVL5iHffqpYfhEc1x/image-1.webp"
            alt="Photo illustrative d’un artisan en intervention devant une habitation"
          />
          <figcaption>
            Photo illustrative — intervention de dépannage
          </figcaption>
        </figure>
        <Link className="btn primary simple-continue" href="/demande">
          Commencer ma demande <ArrowRight size={20} aria-hidden="true" />
        </Link>
        <div className="home-access" aria-label="Choisir un espace">
          <Link className="home-access-card active" href="/demande">
            <strong>Particulier</strong>
            <span>Pour votre domicile</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className="home-access-card" href="/professionnels">
            <strong>Professionnel</strong>
            <span>Entreprise, mairie, HLM, syndic et collectivité</span>
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
        </div>
        <Link href="/demande?libre=1" className="simple-free-request">
          <CircleHelp size={21} aria-hidden="true" />
          Je ne trouve pas mon problème
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/professionnels" className="home-professional-link">
          <strong>Vous êtes une entreprise ou une collectivité ?</strong>
          <span>Gérer vos bâtiments et vos interventions avec MDS.</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
