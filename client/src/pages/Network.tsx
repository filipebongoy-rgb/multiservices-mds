import { useState } from "react";
import { ArrowRight, Copy, MessageCircle, Share2, Users } from "lucide-react";
import { Link } from "wouter";
import { trades } from "@shared/mds";

export default function Network() {
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

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

  async function shareRequest() {
    const query = selectedTrade
      ? `?metier=${encodeURIComponent(selectedTrade)}&source=reseau`
      : "?source=reseau";
    const chosenTrade = trades.find(trade => trade.slug === selectedTrade);
    const detail = requestMessage.trim() || "un dépannage ou des petits travaux";
    const data = {
      title: "Demande MDS à Rennes",
      text: `Je cherche un artisan à Rennes pour ${chosenTrade?.name.toLocaleLowerCase("fr") || "un service"}. ${detail}`,
      url: `${window.location.origin}/demande${query}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        setNotice("Demande partagée. Le destinataire pourra la compléter.");
      } else {
        await navigator.clipboard.writeText(`${data.text} ${data.url}`);
        setNotice("Demande copiée. Vous pouvez l’envoyer à un proche.");
      }
    } catch {
      setNotice(null);
    }
  }

  function openSocial(channel: "whatsapp" | "sms" | "email" | "facebook") {
    const url = `${window.location.origin}/reseau`;
    const text = "MULTISERVICES MDS : un artisan local pour les dépannages et petits travaux à Rennes et alentours.";
    const encodedText = encodeURIComponent(`${text} ${url}`);
    const href = channel === "whatsapp"
      ? `https://wa.me/?text=${encodedText}`
      : channel === "sms"
        ? `sms:?body=${encodedText}`
        : channel === "email"
          ? `mailto:?subject=${encodeURIComponent("Un artisan local à Rennes")}&body=${encodedText}`
          : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(href, "_blank", "noopener,noreferrer");
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

      <section className="network-social-share" aria-label="Partager sur les réseaux sociaux">
        <strong>Partager aussi par</strong>
        <div>
          <button type="button" onClick={() => openSocial("whatsapp")}>WhatsApp</button>
          <button type="button" onClick={() => openSocial("sms")}>SMS</button>
          <button type="button" onClick={() => openSocial("email")}>E-mail</button>
          <button type="button" onClick={() => openSocial("facebook")}>Facebook</button>
        </div>
      </section>

      <section className="network-request-share" aria-labelledby="network-request-share-title">
        <div>
          <span className="eyebrow">Recommandation locale</span>
          <h2 id="network-request-share-title">Partager une demande précise</h2>
          <p>Choisissez le métier et ajoutez quelques mots. Le lien partagé ouvre une demande déjà préparée, sans afficher votre adresse.</p>
        </div>
        <div className="network-request-form">
          <label htmlFor="network-trade">Métier recherché</label>
          <select id="network-trade" value={selectedTrade} onChange={event => setSelectedTrade(event.target.value)}>
            <option value="">Choisir un métier</option>
            {trades.map(trade => <option key={trade.slug} value={trade.slug}>{trade.name}</option>)}
          </select>
          <label htmlFor="network-message">Votre message (facultatif)</label>
          <textarea id="network-message" value={requestMessage} onChange={event => setRequestMessage(event.target.value)} maxLength={240} placeholder="Ex. une fuite sous l’évier…" />
          <button type="button" className="btn dark" onClick={() => void shareRequest()}><MessageCircle size={17} aria-hidden="true" /> Partager cette demande</button>
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

      <section className="network-local-section" aria-labelledby="network-services-title">
        <div className="section-heading">
          <span className="eyebrow">Proximité</span>
          <h2 id="network-services-title">Quel service cherchez-vous à Rennes ?</h2>
          <p className="muted">Choisissez directement un métier. Vous arriverez sur une demande déjà orientée.</p>
        </div>
        <div className="network-service-chips">
          {trades.map(trade => (
            <Link key={trade.slug} href={`/demande?metier=${trade.slug}`} className="network-service-chip">
              <strong>{trade.name}</strong><span>{trade.short}</span><ArrowRight size={16} aria-hidden="true" />
            </Link>
          ))}
          <Link href="/demande?libre=1" className="network-service-chip network-service-chip-other">
            <strong>Autre problème</strong><span>Décrire librement votre besoin</span><ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="network-how" aria-labelledby="network-how-title">
        <div className="section-heading"><span className="eyebrow">Simple comme une demande locale</span><h2 id="network-how-title">De la demande à l’intervention</h2></div>
        <ol>
          <li><strong>1. Décrivez</strong><span>Service, problème, adresse et disponibilité.</span></li>
          <li><strong>2. MDS répond</strong><span>Une réponse claire, un créneau ou un devis.</span></li>
          <li><strong>3. Suivez</strong><span>Artisan en route, photos et fin de travaux contrôlée.</span></li>
        </ol>
      </section>

      <section className="network-privacy-note">
        <strong>Réseau public, dossiers privés.</strong>
        <p>Le réseau sert à partager MDS et à recevoir de nouvelles demandes. Les adresses, photos de chantier, paiements et échanges clients restent visibles uniquement par les personnes autorisées.</p>
      </section>
    </main>
  );
}
