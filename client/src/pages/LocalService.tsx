import { ArrowRight, CheckCircle2, Clock3, MapPin, Phone } from "lucide-react";
import { Link } from "wouter";

export type LocalServiceSlug =
  | "plombier-rennes"
  | "electricien-rennes"
  | "chauffagiste-rennes"
  | "peintre-rennes"
  | "petits-travaux-rennes";

type LocalService = {
  slug: LocalServiceSlug;
  title: string;
  heading: string;
  intro: string;
  description: string;
  services: string[];
  searches: string[];
};

export const localServices: Record<LocalServiceSlug, LocalService> = {
  "plombier-rennes": {
    slug: "plombier-rennes",
    title: "Plombier à Rennes — dépannage et travaux à domicile",
    heading: "Plombier à Rennes et alentours",
    intro: "Une fuite d’eau, un évier bouché ou un robinet à remplacer ? Décrivez votre besoin à MULTISERVICES MDS.",
    description: "MDS organise les demandes de plomberie à Rennes et dans un rayon d’environ 30 km : dépannage plomberie, recherche de fuite, débouchage WC et évier, robinetterie, lavabo, douche, chauffe-eau et installation sanitaire.",
    services: ["Fuite d’eau et recherche de fuite", "Débouchage évier et WC", "Réparation ou installation de robinet", "Lavabo, douche et chauffe-eau"],
    searches: ["plombier disponible rapidement", "artisan plombier à domicile", "devis plomberie à Rennes"],
  },
  "electricien-rennes": {
    slug: "electricien-rennes",
    title: "Électricien à Rennes — dépannage et installation",
    heading: "Électricien à Rennes et alentours",
    intro: "Plus de lumière, une prise à changer ou un luminaire à poser ? Expliquez simplement le problème.",
    description: "MDS reçoit les demandes d’électricité à Rennes : panne électrique, prises, interrupteurs, éclairage, tableau électrique, disjoncteur, mise en sécurité et VMC, selon les prestations activées.",
    services: ["Panne électrique et court-circuit", "Prises, interrupteurs et éclairage", "Tableau électrique et disjoncteur", "Installation et entretien de VMC"],
    searches: ["électricien à domicile", "réparer une panne électrique", "installation luminaire à Rennes"],
  },
  "chauffagiste-rennes": {
    slug: "chauffagiste-rennes",
    title: "Chauffagiste à Rennes — chauffage et radiateurs",
    heading: "Chauffage et radiateurs à Rennes",
    intro: "Votre radiateur ne chauffe plus ou votre chauffage doit être entretenu ? Envoyez votre demande en quelques mots.",
    description: "MDS centralise les demandes de chauffage à Rennes et autour : radiateur en panne, chaudière, thermostat, entretien et circuit de chauffage. Le besoin est analysé avant confirmation de l’intervention.",
    services: ["Radiateur qui ne chauffe plus", "Panne de chauffage", "Chaudière et thermostat", "Entretien du circuit de chauffage"],
    searches: ["chauffagiste près de chez moi", "radiateur en panne", "dépannage chauffage à Rennes"],
  },
  "peintre-rennes": {
    slug: "peintre-rennes",
    title: "Peintre à Rennes — peinture intérieure et rénovation",
    heading: "Peinture intérieure à Rennes",
    intro: "Vous voulez repeindre une chambre, un plafond ou rafraîchir un appartement ? Décrivez les pièces concernées.",
    description: "MDS organise les demandes de peinture à Rennes : peinture murale, plafond, portes, préparation des surfaces, rebouchage, ponçage et rénovation intérieure, avec devis lorsque le chantier doit être évalué.",
    services: ["Peinture de murs et plafonds", "Rafraîchissement d’appartement", "Rebouchage et enduit mural", "Préparation, ponçage et finition"],
    searches: ["peintre en bâtiment à Rennes", "peindre une chambre", "devis peinture intérieure"],
  },
  "petits-travaux-rennes": {
    slug: "petits-travaux-rennes",
    title: "Petits travaux à Rennes — artisan multiservices",
    heading: "Petits travaux et bricolage à Rennes",
    intro: "Meuble à monter, étagère à fixer ou petite réparation à domicile ? MDS vous aide à formuler votre demande.",
    description: "MDS reçoit les demandes de petits travaux à Rennes : montage de meubles, fixation d’étagères, pose de tringles, réglages, réparation de porte et entretien courant, selon le périmètre validé.",
    services: ["Montage de meubles et pose de mobilier", "Fixation d’étagères, tringles et TV", "Réglage de porte, fenêtre ou tiroir", "Petites réparations à domicile"],
    searches: ["bricoleur à domicile", "homme toutes mains à Rennes", "artisan multiservices"],
  },
};

export function LocalServicePage({ slug }: { slug: LocalServiceSlug }) {
  const service = localServices[slug];
  return (
    <main id="main-content" className="page-shell local-service-page">
      <div className="eyebrow">MULTISERVICES MDS · RENNES + 30 KM</div>
      <h1 className="page-title">{service.heading}</h1>
      <p className="lead">{service.intro}</p>
      <div className="local-service-actions">
        <Link className="btn primary" href={`/demande?metier=${slug.replace("-rennes", "")}`}>
          Décrire mon besoin <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <a className="btn secondary" href="tel:0604159916"><Phone size={17} aria-hidden="true" /> Appeler MDS</a>
      </div>
      <section className="local-service-panel" aria-labelledby="local-service-description">
        <h2 id="local-service-description">Un artisan pour votre demande à Rennes</h2>
        <p>{service.description}</p>
        <div className="local-service-facts">
          <span><MapPin size={17} aria-hidden="true" /> Rennes et alentours</span>
          <span><Clock3 size={17} aria-hidden="true" /> Réponse après analyse</span>
          <span><CheckCircle2 size={17} aria-hidden="true" /> Demande sans engagement</span>
        </div>
      </section>
      <section className="local-service-panel" aria-labelledby="local-service-list">
        <h2 id="local-service-list">Services recherchés</h2>
        <ul>{service.services.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="muted">Vous ne trouvez pas le bon intitulé ? Écrivez votre problème avec vos propres mots. MDS vous répond dans le même dossier.</p>
      </section>
      <section className="local-service-searches" aria-labelledby="local-service-searches-title">
        <h2 id="local-service-searches-title">Les demandes que nous recevons</h2>
        <div>{service.searches.map(search => <span key={search}>{search}</span>)}</div>
      </section>
      <p className="local-service-links"><Link href="/prestations">Voir toutes les prestations</Link> · <Link href="/">Retour à l’accueil</Link></p>
    </main>
  );
}
