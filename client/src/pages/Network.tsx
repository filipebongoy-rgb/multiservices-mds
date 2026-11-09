import { useState } from "react";
import { ArrowRight, Copy, MessageCircle, Share2, Users } from "lucide-react";
import { Link } from "wouter";

export default function Network() {
  const [notice, setNotice] = useState<string | null>(null);

  async function shareMds() {
    const data = {
      title: "MULTISERVICES MDS — artisan local à Rennes",
      text: "Un artisan local pour les dépannages et petits travaux à Rennes et alentours.",
      url: window.location.origin,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        setNotice("Partage effectué.");
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        setNotice("Lien copié. Vous pouvez le publier ou l’envoyer.");
      }
    } catch {
      setNotice(null);
    }
  }

  return (
    <main id="main-content" className="page-shell network-page">
      <header className="public-page-heading">
        <span className="eyebrow">Réseau MDS</span>
        <h1>Partager MDS à Rennes</h1>
        <p>Recommandez l’artisan à un proche ou envoyez une demande. Les dossiers clients restent privés et ne sont jamais publiés automatiquement.</p>
      </header>

      <section className="network-hero-card" aria-label="Partager MDS">
        <div className="network-hero-icon"><Share2 size={28} aria-hidden="true" /></div>
        <div><h2>Un voisin cherche un artisan ?</h2><p>Partagez le lien MDS. La personne décrit elle-même son problème et reçoit les prochaines étapes.</p></div>
        <div className="network-share-action">
          <button type="button" className="btn primary" onClick={() => void shareMds()}><Share2 size={17} aria-hidden="true" /> Partager MDS</button>
          {notice && <span role="status" className="home-share-notice">{notice}</span>}
        </div>
      </section>

      <section className="network-card-grid" aria-label="Actions du réseau MDS">
        <Link className="network-action-card" href="/demande">
          <MessageCircle size={24} aria-hidden="true" /><strong>Déposer une demande</strong><span>Décrire un problème, ajouter des photos et choisir une disponibilité.</span><ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link className="network-action-card" href="/portfolio">
          <Users size={24} aria-hidden="true" /><strong>Voir les réalisations</strong><span>Consulter les photos avant/après et les avis publiés après validation.</span><ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link className="network-action-card" href="/suivi">
          <Copy size={24} aria-hidden="true" /><strong>Partager mon suivi</strong><span>Retrouver le lien sécurisé de votre demande sans exposer vos informations.</span><ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>

      <section className="network-privacy-note">
        <strong>Réseau public, dossiers privés.</strong>
        <p>Le réseau sert à partager MDS et à recevoir de nouvelles demandes. Les adresses, photos de chantier, paiements et échanges clients restent visibles uniquement par les personnes autorisées.</p>
      </section>
    </main>
  );
}
