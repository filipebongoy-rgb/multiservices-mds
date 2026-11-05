import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  CircleHelp,
  Clock,
  Droplets,
  FileText,
  Flame,
  Paintbrush,
  House,
  Phone,
  ShieldCheck,
  ThumbsUp,
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
              <strong>Votre confort, notre priorité !</strong> Plomberie,
              chauffage, électricité, peinture et petits travaux à Rennes et ses
              alentours.
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
            <strong>Espace professionnel</strong>
            <span>
              Mairie, HLM, syndic, hôpital, école, centre commercial · Contrats
              mensuels ou annuels
            </span>
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
                <small className="simple-trade-hint">{trade.short}</small>
              </Link>
            );
          })}
          <Link href="/demande?libre=1" className="simple-trade simple-other">
            <CircleHelp size={25} strokeWidth={1.7} aria-hidden="true" />
            <span>Autre besoin</span>
            <small className="simple-trade-hint">
              décrivez votre problème librement
            </small>
          </Link>
        </div>
      </section>
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
      <section className="home-phone-cta">
        <span>Une urgence ? Un seul pro pour tous vos travaux :</span>
        <a href="tel:0604159916">
          <Phone size={18} aria-hidden="true" /> 06 04 15 99 16
        </a>
      </section>
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
