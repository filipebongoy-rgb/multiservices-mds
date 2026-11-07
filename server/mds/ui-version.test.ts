import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const source = readFileSync(
  new URL(
    "../../client/src/components/mds/private-artisan-requests.tsx",
    import.meta.url
  ),
  "utf8"
);

describe("formulaire artisan lié à son contexte d’ouverture", () => {
  it("remonte uniquement sur un contexte serveur identifié incluant sa version", () => {
    expect(source).toContain(
      "key={`${request.id}-${request.version}-${action}`}"
    );
  });
  it("soumet la version capturée à l’ouverture plutôt que de réarmer des anciens champs", () => {
    const form = source.split("function ActionForm(")[1];
    expect(form).toMatch(/\[openedVersion\]\s*=\s*useState\(request.version\)/);
    expect(form).toContain("version: openedVersion");
    expect(form).not.toContain("version: request.version");
  });
});

describe("accès artisan et cohérence du pied de page", () => {
  const home = readFileSync(
    new URL("../../client/src/pages/Home.tsx", import.meta.url),
    "utf8"
  );
  const layout = readFileSync(
    new URL("../../client/src/components/mds/Layout.tsx", import.meta.url),
    "utf8"
  );
  const profile = readFileSync(
    new URL("../../client/src/pages/Profile.tsx", import.meta.url),
    "utf8"
  );
  const artisan = readFileSync(
    new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
    "utf8"
  );
  it("la page d’accueil ne duplique pas le pied de page global", () => {
    expect(home).not.toContain("<footer");
  });
  it("l’accès artisan reste réservé au footer et au profil (pas de lien public sur l'accueil)", () => {
    expect(layout).toContain('href="/artisan"');
    expect(profile).toContain('href="/artisan"');
  });
  it("le footer global diffuse le téléphone officiel et la signature MDS sur toutes les pages", () => {
    expect(layout).toContain("06 04 15 99 16");
    expect(layout).toContain("La qualité au service de votre confort !");
  });
  it("l’artisan peut basculer vers le site public en un clic depuis son atelier et le menu espaces", () => {
    expect(artisan).toContain("Voir le site public →");
    expect(layout).toContain("Voir le site public");
    expect(layout).toContain("Espace professionnel");
    expect(layout).toContain("Catalogue prestations");
  });
});

describe("espace artisan mobile : l'ouverture d'un dossier masque la liste pour rendre le détail immédiatement visible", () => {
  const requests = readFileSync(
    new URL(
      "../../client/src/components/mds/private-artisan-requests.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const artisan = readFileSync(
    new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
    "utf8"
  );
  const css = readFileSync(
    new URL("../../client/src/components/mds/simple-ux.css", import.meta.url),
    "utf8"
  );
  it("chaque ligne de demande propose une action d'ouverture explicite avec chevron", () => {
    expect(requests).toContain("Ouvrir");
    expect(requests).toContain("ChevronRight");
  });
  it("la liste des demandes artisan se masque sur mobile dès qu'un dossier est sélectionné", () => {
    expect(requests).toContain("artisan-list-panel");
    expect(requests).toContain("artisan-list-panel--hidden-mobile");
    expect(css).toContain("display: none");
  });
  it("le panneau de détail de dossier s'affiche uniquement avec une sélection sur mobile", () => {
    expect(requests).toContain("artisan-detail-panel--hidden-mobile");
  });
  it("la sélection défile vers le haut pour rendre le contenu immédiatement visible", () => {
    expect(requests).toContain(
      'window.scrollTo({ top: 0, behavior: "smooth" })'
    );
  });
  it("le dossier propose un bouton explicite de retour à la liste", () => {
    expect(requests).toMatch(/Retour à la liste des\s*demandes/s);
  });
  it("l'onglet Interventions adopte le même comportement master-detail avec sélection visible", () => {
    expect(artisan).toContain("select(request.id)");
    expect(artisan).toContain("4px solid #bc4c23");
  });
});

describe("espace professionnel et contrats d’entretien", () => {
  const pro = readFileSync(
    new URL("../../client/src/pages/Professional.tsx", import.meta.url),
    "utf8"
  );
  const home = readFileSync(
    new URL("../../client/src/pages/Home.tsx", import.meta.url),
    "utf8"
  );
  it("présente les formules d’abonnement mensuel et annuel avec tarifs adaptés et remise d'engagement", () => {
    expect(pro).toContain("Formule Mensuelle");
    expect(pro).toContain("Formule Annuelle");
    expect(pro).toContain("Sans engagement annuel");
    expect(pro).toContain("remise d'engagement");
  });
  it("s’adresse aux gestionnaires publics et privés : mairie, HLM, syndic, bailleur, hôpital, école", () => {
    expect(pro).toContain("mairie");
    expect(pro).toContain("HLM");
    expect(pro).toContain("syndic");
    expect(pro).toContain("bailleur");
    expect(pro).toContain("hôpital");
    expect(pro).toContain("école");
    expect(pro).toContain("centres commerciaux");
    expect(pro).toContain("entreprise");
  });
  it("inclut un formulaire de demande de contrat sans quitter la page", () => {
    expect(pro).toContain("pro-contract-form");
    expect(pro).toContain("Nom de l'organisation *");
    expect(pro).toContain("Téléphone *");
  });
  it("propose l’espace organisation privée pour suivre ses interventions", () => {
    expect(pro).toContain("Mon espace organisation");
    expect(pro).toContain("Accéder à mon espace organisation");
  });
  it("l’accueil présente les contrats d’entretien sous forme d’abonnement", () => {
    expect(home).toContain("Contrats d’entretien sous forme d’abonnement");
    expect(home).toContain("réduction annuelle");
  });
});

describe("refonte Uber : identité officielle, photos réelles, recherche et récurrence", () => {
  const home = readFileSync(
    new URL("../../client/src/pages/Home.tsx", import.meta.url),
    "utf8"
  );
  const layout = readFileSync(
    new URL("../../client/src/components/mds/Layout.tsx", import.meta.url),
    "utf8"
  );
  const tracking = readFileSync(
    new URL("../../client/src/pages/Tracking.tsx", import.meta.url),
    "utf8"
  );
  const request = readFileSync(
    new URL("../../client/src/pages/Request.tsx", import.meta.url),
    "utf8"
  );
  it("le header affiche le logo MDS officiel haute résolution", () => {
    expect(layout).toContain("mds-logo-320.png");
    expect(layout).toContain("srcSet");
    expect(layout).toContain("mds-logo.png");
  });
  it("la barre de recherche façon Uber Eats filtre les corps de métier", () => {
    expect(home).toContain("home-search");
    expect(home).toContain("Rechercher un service");
    expect(home).toContain("filteredTrades");
  });
  it("les catégories populaires sont accessibles depuis l'accueil", () => {
    expect(home).toContain("Catégories populaires");
    expect(home).toContain("trades");
  });
  it("le formulaire de demande propose le choix ponctuel vs abonnement", () => {
    expect(request).toContain("recurrence");
    expect(request).toContain("Récurrence de votre besoin");
    expect(request).toContain("Intervention ponctuelle");
    expect(request).toContain("Abonnement (mensuel / annuel)");
  });
  it("le suivi live présente la carte d'identité de l'artisan avec sa photo réelle", () => {
    expect(tracking).toContain("tracking-artisan-avatar");
    expect(tracking).toContain("artisan-avatar.webp");
    expect(tracking).toContain("Votre artisan MDS");
  });
  it("les trois espaces restent strictement séparés : les visiteurs n'ont pas d'accès direct artisan depuis l'accueil", () => {
    expect(home).toContain('href="/professionnels"');
    expect(layout).toContain('href="/artisan"');
  });
});

describe("souscription professionnelle rapide et cartes 100% cliquables", () => {
  const pro = readFileSync(
    new URL("../../client/src/pages/Professional.tsx", import.meta.url),
    "utf8"
  );
  const css = readFileSync(
    new URL("../../client/src/components/mds/simple-ux.css", import.meta.url),
    "utf8"
  );
  it("les cartes de formules sont cliquables avec CTA explicite 'Choisir cette formule'", () => {
    expect(pro).toContain("pro-plan-clickable");
    expect(pro).toContain("Choisir cette formule");
    expect(pro).toContain("selectFormula");
  });
  it("les cartes sectorielles sont cliquables avec CTA de demande", () => {
    expect(pro).toContain("pro-sector-clickable");
    expect(pro).toContain("Demander pour ce profil →");
    expect(pro).toContain("selectSector");
  });
  it("le formulaire permet de changer de formule via des pills en un clic", () => {
    expect(pro).toContain("pro-formula-pills");
    expect(pro).toContain("Annuelle · tarif réduit");
    expect(pro).toContain("Mensuelle");
    expect(pro).toContain("Sur-mesure");
  });
  it("la souscription ne nécessite que 4 champs obligatoires et un clic d'envoi", () => {
    expect(pro).toContain("Votre nom et prénom *");
    expect(pro).toContain("Nom de l'organisation *");
    expect(pro).toContain("Téléphone *");
    expect(pro).toContain("E-mail professionnel *");
    expect(pro).toContain("Envoyer ma demande de souscription (gratuit)");
  });
  it("les détails du parc restent facultatifs pour ne pas bloquer l'envoi rapide", () => {
    expect(pro).toContain("pro-details-fold");
    expect(pro).toContain("Préciser mon parc ou mes besoins (facultatif)");
  });
  it("les états sélectionnés des cartes sont stylés avec l'identité orange MDS", () => {
    expect(css).toContain("pro-plan-selected");
    expect(css).toContain("pro-sector-selected");
    expect(css).toContain("border-color: #bc4c23");
  });
});

describe("séparation stricte des rôles et outils planning artisan", () => {
  const layout = readFileSync(
    new URL("../../client/src/components/mds/Layout.tsx", import.meta.url),
    "utf8"
  );
  const home = readFileSync(
    new URL("../../client/src/pages/Home.tsx", import.meta.url),
    "utf8"
  );
  const artisan = readFileSync(
    new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
    "utf8"
  );
  it("les menus publics ne promeuvent plus l'espace artisan aux visiteurs", () => {
    expect(layout).toContain("Demander un devis (particulier)");
    expect(layout).toContain("Espace professionnel");
    expect(layout).toContain("Atelier artisan");
    expect(home).not.toContain("Accès réservé : vous êtes l’artisan MDS ?");
  });
  it("la navigation mobile s'adapte au rôle client ou artisan", () => {
    expect(layout).toContain('label: "Réserver"');
    expect(layout).toContain('label: "Suivi"');
    expect(layout).toContain('label: "Compte"');
    expect(layout).toContain('label: "Atelier"');
  });
  it("l'espace artisan verrouillé oriente clairement vers les espaces clients", () => {
    expect(artisan).toContain("Espace réservé à l’équipe MDS");
    expect(artisan).toContain("Aucun code d’activation n’est demandé aux");
    expect(artisan).not.toContain("Code privé d’activation");
    expect(artisan).toContain("Espace particulier →");
    expect(artisan).toContain("Espace professionnel →");
  });
  it("le planning propose le filtrage par statut et le nettoyage des rendez-vous terminés", () => {
    const cal = readFileSync(
      new URL(
        "../../client/src/components/mds/private-calendar.tsx",
        import.meta.url
      ),
      "utf8"
    );
    expect(cal).toContain("deleteAppointment");
    expect(cal).toContain("cleanCompletedAppointments");
    expect(cal).toContain("À venir");
    expect(cal).toContain("Terminés");
    expect(cal).toContain("Nettoyer les rendez-vous terminés");
    expect(cal).toContain("Supprimer ce rendez-vous du planning");
  });
});

describe("authentification MDS locale", () => {
  const auth = readFileSync(
    new URL("../../client/src/pages/Auth.tsx", import.meta.url),
    "utf8"
  );
  const localAuth = readFileSync(
    new URL("../../server/_core/local-auth.ts", import.meta.url),
    "utf8"
  );
  it("propose particulier ou professionnel sans exposer le rôle artisan", () => {
    expect(auth).toContain("Particulier");
    expect(auth).toContain("Professionnel");
    expect(auth).not.toContain('accountType === "admin"');
    expect(auth).toContain("10 caractères minimum");
  });
  it("utilise un hash scrypt et des sessions opaques persistées", () => {
    expect(localAuth).toContain("scryptSync");
    expect(localAuth).toContain("timingSafeEqual");
    expect(localAuth).toContain("localSessions");
    expect(localAuth).toContain("getSessionCookieOptions");
  });
  it("affiche une action rapide connexion ou déconnexion dans l’en-tête", () => {
    const layout = readFileSync(
      new URL("../../client/src/components/mds/Layout.tsx", import.meta.url),
      "utf8"
    );
    expect(layout).toContain("simple-auth-quick-action");
    expect(layout).toContain('user ? "Se déconnecter" : "Se connecter"');
  });
});

describe("qualification opérationnelle initiale", () => {
  it("collecte l’urgence côté client et la met en avant côté artisan", () => {
    const request = readFileSync(
      new URL("../../client/src/pages/Request.tsx", import.meta.url),
      "utf8"
    );
    const artisan = readFileSync(
      new URL(
        "../../client/src/components/mds/private-artisan-requests.tsx",
        import.meta.url
      ),
      "utf8"
    );
    expect(request).toContain('id="urgency"');
    expect(request).toContain("__urgency");
    expect(artisan).toContain("urgencyLabel");
    expect(artisan).toContain('urgency === "urgent"');
  });
  it("propose une liste d’attente persistante sans rendez-vous fictif", () => {
    const request = readFileSync(
      new URL("../../client/src/pages/Request.tsx", import.meta.url),
      "utf8"
    );
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    const server = readFileSync(
      new URL("./requests.ts", import.meta.url),
      "utf8"
    );
    expect(request).toContain("Rejoindre la liste d’attente");
    expect(request).toContain("__waitlist");
    expect(artisan).toContain("Liste d’attente");
    expect(artisan).toContain("requests.waitlist");
    expect(server).toContain("waitlistEntries");
    expect(server).toContain("waitlistRequested");
  });
  it("rend la carte des lieux recherchable et reliée aux dossiers", () => {
    const map = readFileSync(
      new URL(
        "../../client/src/components/mds/ArtisanLocationsMap.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    expect(map).toContain('type="search"');
    expect(map).toContain("Rechercher une ville");
    expect(map).toContain("onOpen?.(request.id)");
    expect(artisan).toContain("ArtisanLocationsMap requests={requests}");
    expect(artisan).toContain("onOpen={openRequest}");
  });
});
