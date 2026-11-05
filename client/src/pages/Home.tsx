import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  Droplets,
  Zap,
  Flame,
  Paintbrush,
  Wrench,
  ShieldCheck,
  UserRound,
  Check,
  MessageSquareText,
  CalendarCheck2,
  Building2,
} from "lucide-react";
import { trades } from "@shared/mds";
import { FreeRequest } from "@/components/mds/Layout";

const icons = [Droplets, Zap, Flame, Paintbrush, Wrench];
export default function Home() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  return (
    <main id="main-content">
      <section className="hero page-shell">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="accent-line" />
            VOTRE ARTISAN, EN TOUTE SIMPLICITÉ
          </div>
          <h1>
            Un problème chez vous ?<br />
            <span>On s’en occupe.</span>
          </h1>
          <p className="hero-description">
            Réparations, travaux, maintenance. Décrivez votre besoin et échangez
            directement avec votre artisan MDS.
          </p>
          <form
            className="hero-search"
            onSubmit={e => {
              e.preventDefault();
              navigate(
                "/prestations" +
                  (search ? "?q=" + encodeURIComponent(search) : "")
              );
            }}
          >
            <Search size={21} aria-hidden="true" />
            <label className="sr-only" htmlFor="home-search">
              Quelle prestation recherchez-vous ?
            </label>
            <input
              id="home-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Une fuite, une prise, un mur à repeindre…"
            />
            <button
              type="submit"
              className="btn primary"
              aria-label="Rechercher une prestation"
            >
              <ArrowRight size={21} />
            </button>
          </form>
          <div className="hero-search-note">
            Pas besoin de connaître le terme technique.
          </div>
          <div className="hero-trust">
            <span>
              <UserRound size={17} />
              Un seul interlocuteur
            </span>
            <span>
              <ShieldCheck size={17} />
              Sans compte obligatoire
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <img
            src="/manus-storage/async-images/zoVhuCljL7XFOCDDlz8mDJ/image-1.webp"
            alt="Visuel photographique illustratif : mains d’un artisan ajustant une installation de plomberie"
          />
          <span className="photo-caption">VISUEL D’ILLUSTRATION</span>
          <div className="hero-note">
            <span className="note-symbol">
              <Check size={20} />
            </span>
            <div>
              <strong>Vous demandez. Nous échangeons.</strong>
              <small>Vous confirmez avant toute intervention.</small>
            </div>
          </div>
          <span className="image-corner" aria-hidden="true" />
        </div>
      </section>
      <section className="trade-section page-shell">
        <div className="section-heading">
          <div>
            <div className="eyebrow">QUEL EST VOTRE BESOIN ?</div>
            <h2>Les métiers, au même endroit.</h2>
          </div>
          <Link href="/prestations" className="text-link">
            Explorer le catalogue
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="trade-grid">
          {trades.map((t, i) => {
            const Icon = icons[i];
            return (
              <Link
                key={t.slug}
                href={"/prestations?metier=" + t.slug}
                className="trade-card"
              >
                <span className="trade-icon">
                  <Icon size={27} strokeWidth={1.6} />
                </span>
                <h3>{t.name}</h3>
                <p>{t.short}</p>
                <ArrowUpRight size={18} className="trade-arrow" />
              </Link>
            );
          })}
        </div>
        <p className="catalog-disclaimer">
          Les prestations disponibles dépendent de la validation de MDS et de
          votre adresse.
        </p>
        <FreeRequest />
      </section>
      <section className="how-section">
        <div className="page-shell">
          <div className="how-intro">
            <div>
              <div className="eyebrow">DU PREMIER MESSAGE AU RENDEZ-VOUS</div>
              <h2>Les travaux, sans les complications.</h2>
            </div>
            <p>
              Une demande n’est pas un rendez-vous définitif.
              <br />
              Vous gardez la main à chaque étape.
            </p>
          </div>
          <div className="steps-grid">
            <div className="how-step">
              <span className="step-index">01</span>
              <MessageSquareText size={24} />
              <h3>Décrivez votre besoin</h3>
              <p>
                Quelques mots, votre adresse et, si vous le souhaitez, une photo
                ou un créneau.
              </p>
            </div>
            <div className="how-step">
              <span className="step-index">02</span>
              <UserRound size={24} />
              <h3>MDS vous fait une proposition</h3>
              <p>
                Votre artisan analyse la demande et précise les conditions, le
                tarif et le créneau.
              </p>
            </div>
            <div className="how-step">
              <span className="step-index">03</span>
              <CalendarCheck2 size={24} />
              <h3>Vous confirmez, c’est planifié</h3>
              <p>
                Le rendez-vous est confirmé après votre accord. Suivez ensuite
                son avancement.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="pro-banner page-shell">
        <div className="pro-label">
          <Building2 size={27} />
          <span>POUR LES PROFESSIONNELS</span>
        </div>
        <div>
          <h2>Plusieurs sites. Un seul point de suivi.</h2>
          <p>
            Entreprises, syndics, bailleurs : rassemblez vos demandes, vos sites
            et vos documents.
          </p>
        </div>
        <Link href="/professionnels" className="btn secondary">
          Découvrir l’espace pro
          <ArrowUpRight size={18} />
        </Link>
      </section>
    </main>
  );
}
