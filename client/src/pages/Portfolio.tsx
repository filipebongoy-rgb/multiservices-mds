import { Link } from "wouter";
import { ArrowRight, Camera, CheckCircle2, ShieldCheck, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Portfolio() {
  const portfolio = trpc.mds.portfolio.list.useQuery();
  const reviews = portfolio.data || [];

  return (
    <main id="main-content" className="page-shell portfolio-page">
      <header className="public-page-heading">
        <span className="eyebrow">Réalisations MDS</span>
        <h1>Voir le travail avant de demander</h1>
        <p>Les réalisations publiées sont vérifiées par MDS et affichées uniquement avec l’accord nécessaire du client.</p>
      </header>

      <section className="portfolio-trust-grid" aria-label="Engagements portfolio">
        <div><Camera size={22} aria-hidden="true" /><strong>Photos avant / après</strong><span>Ajoutées au dossier de l’intervention.</span></div>
        <div><CheckCircle2 size={22} aria-hidden="true" /><strong>Mission terminée</strong><span>Une réalisation ne s’affiche qu’après la fin du chantier.</span></div>
        <div><ShieldCheck size={22} aria-hidden="true" /><strong>Avis contrôlés</strong><span>Les avis sont modérés avant publication.</span></div>
      </section>

      <section className="portfolio-section" aria-labelledby="portfolio-work-title">
        <div className="section-heading">
          <div><span className="eyebrow">Avant / après</span><h2 id="portfolio-work-title">Missions réalisées</h2></div>
        </div>
        <div className="portfolio-empty">
          <Camera size={30} aria-hidden="true" />
          <h3>Les prochaines réalisations arrivent ici</h3>
          <p>Les photos des missions terminées restent privées par défaut. Elles seront publiées uniquement après accord du client et validation MDS.</p>
          <Link className="btn primary" href="/demande">Demander une intervention <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="portfolio-section" aria-labelledby="portfolio-reviews-title">
        <div className="section-heading">
          <div><span className="eyebrow">Confiance locale</span><h2 id="portfolio-reviews-title">Avis clients</h2></div>
        </div>
        {portfolio.isLoading ? <p className="muted">Chargement des avis vérifiés…</p> : reviews.length === 0 ? (
          <div className="portfolio-empty portfolio-review-empty">
            <Star size={28} aria-hidden="true" />
            <h3>Pas encore d’avis publié</h3>
            <p>Après une intervention terminée, le client peut laisser une note et un commentaire depuis sa page de suivi. MDS contrôle l’avis avant de l’afficher.</p>
            <Link className="btn secondary" href="/suivi">Accéder à mon suivi</Link>
          </div>
        ) : (
          <div className="portfolio-review-grid">
            {reviews.map(review => (
              <article className="portfolio-review-card" key={review.id}>
                <div className="portfolio-stars" aria-label={`${review.rating} sur 5`}>
                  {Array.from({ length: review.rating }).map((_, index) => <Star key={index} size={16} fill="currentColor" aria-hidden="true" />)}
                </div>
                <p>“{review.comment || "Intervention réalisée avec succès."}”</p>
                <small>{review.serviceName || "Prestation MDS"} · {review.city}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="portfolio-bottom-cta">
        <div><strong>Vous avez besoin d’un artisan à Rennes ?</strong><span>Décrivez votre problème. MDS vous répond avec la prochaine étape.</span></div>
        <Link className="btn dark" href="/demande">Décrire mon besoin <ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
    </main>
  );
}
