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
  it("l’accès artisan est exposé depuis l’accueil, le header, le footer et le profil", () => {
    expect(home).toContain('href="/artisan"');
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
  const artisanCss = readFileSync(
    new URL("../../client/src/components/mds/simple-ux.css", import.meta.url),
    "utf8"
  );
  it("les demandes artisan adoptent le master-detail avec masquage conditionnel de la liste sur mobile", () => {
    expect(source).toContain("artisan-list-panel");
    expect(source).toContain("artisan-list-panel--hidden-mobile");
    expect(source).toContain("artisan-detail-panel--hidden-mobile");
    expect(source).toContain("artisan-detail-panel");
  });
  it("l'onglet interventions reprend le même comportement", () => {
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    expect(artisan).toContain("artisan-list-panel--hidden-mobile");
    expect(artisan).toContain("artisan-detail-panel--hidden-mobile");
  });
  it("les règles CSS responsive masquent le panneau inactif sous le breakpoint split-view", () => {
    expect(artisanCss).toContain("artisan-list-panel--hidden-mobile");
    expect(artisanCss).toContain("artisan-detail-panel--hidden-mobile");
    expect(artisanCss).toContain("display: none !important");
  });
  it("chaque dossier porte une invite explicite d'ouverture et un retour visible vers la liste", () => {
    expect(source).toContain("<span>Ouvrir</span>");
    expect(source).toMatch(/Retour\s+à\s+la\s+liste\s+des\s+demandes/);
  });
});

describe("espace professionnel : offre dédiée avec contrats mensuels/annuels et tarifs adaptés", () => {
  const pro = readFileSync(
    new URL("../../client/src/pages/Professional.tsx", import.meta.url),
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
  it("la page pro cible explicitement tous les secteurs demandés", () => {
    expect(pro).toContain("Mairies & collectivités territoriales");
    expect(pro).toContain("Bailleurs sociaux & organismes HLM");
    expect(pro).toContain("Syndics & gestionnaires de copropriétés");
    expect(pro).toContain("Hôpitaux, cliniques & établissements de santé");
    expect(pro).toContain("Écoles, crèches & établissements scolaires");
    expect(pro).toContain("Centres commerciaux, galeries & commerces");
    expect(pro).toContain("Entreprises, bureaux & locaux professionnels");
  });
  it("l'offre présente des formules d'abonnement mensuelle/annuelle avec tarif réduit", () => {
    expect(pro).toContain("Formule Mensuelle");
    expect(pro).toContain("Formule Annuelle");
    expect(pro).toContain("tarif réduit");
    expect(pro).toContain("réduction");
  });
  it("la page sépare l'offre publique et l'espace organisation connecté", () => {
    expect(pro).toContain("Offre professionnels &amp; contrats");
    expect(pro).toContain("Mon espace organisation");
    expect(pro).toContain("OrganizationDetail");
  });
  it("la page propose un formulaire de demande de contrat et les contacts directs", () => {
    expect(pro).toContain("Demander une proposition de contrat");
    expect(pro).toContain("06 04 15 99 16");
    expect(pro).toContain("contact@multiservices-mds.fr");
  });
  it("les écrans pro et artisan se renvoient l'un vers l'autre pour éviter toute confusion", () => {
    expect(pro).toContain('href="/artisan"');
    expect(artisan).toContain('href="/professionnels"');
  });
  it("l'accueil met en avant les secteurs et contrats sur ses deux cartes professionnelles", () => {
    expect(home).toContain("Espace professionnel — mairie, HLM");
    expect(home).toContain("Contrats d’entretien");
  });
});

describe("refonte Uber : identité officielle, photos réelles, recherche et récurrence", () => {
  const layout = readFileSync(
    new URL("../../client/src/components/mds/Layout.tsx", import.meta.url),
    "utf8"
  );
  const home = readFileSync(
    new URL("../../client/src/pages/Home.tsx", import.meta.url),
    "utf8"
  );
  const request = readFileSync(
    new URL("../../client/src/pages/Request.tsx", import.meta.url),
    "utf8"
  );
  const tracking = readFileSync(
    new URL("../../client/src/pages/Tracking.tsx", import.meta.url),
    "utf8"
  );
  it("le logo officiel MDS est utilisé avec srcset pour les écrans haute résolution", () => {
    expect(layout).toContain("mds-logo-320.png");
    expect(layout).toContain("mds-logo-180.png 180w");
    expect(layout).toContain("mds-logo.png 1254w");
  });
  it("le héro d'accueil est une carte sombre contenue avec le logo officiel en carte visuelle (texte 100% lisible)", () => {
    expect(home).toContain("simple-hero");
    expect(home).toContain("simple-hero-visual");
    expect(home).toContain("simple-hero-logo");
    expect(home).toContain("mds-logo-320.png");
    expect(home).not.toContain("hero-artisan.webp");
  });
  it("l'accueil intègre les fiches confiance inspirées du splash Uber", () => {
    expect(home).toContain("home-trust-chip");
    expect(home).toContain("Fiable");
    expect(home).toContain("Rapide");
    expect(home).toContain("À proximité");
  });
  it("l'accueil propose une barre de recherche de services avec filtre instantané", () => {
    expect(home).toContain('role="search"');
    expect(home).toContain("home-search-bar");
    expect(home).toContain("Catégories populaires");
  });
  it("la demande d'intervention propose le choix ponctuel vs abonnement (mensuel/annuel)", () => {
    expect(request).toContain("Récurrence de votre besoin");
    expect(request).toContain("Intervention ponctuelle");
    expect(request).toContain("Abonnement (mensuel / annuel)");
  });
  it("le suivi live présente la carte d'identité de l'artisan avec sa photo réelle", () => {
    expect(tracking).toContain("tracking-artisan-avatar");
    expect(tracking).toContain("artisan-avatar.webp");
    expect(tracking).toContain("Votre artisan MDS");
  });
  it("la navigation mobile s'aligne sur la maquette avec un onglet Contrats", () => {
    expect(layout).toContain('"Contrats"');
    expect(layout).toContain('href: "/professionnels"');
  });
  it("les trois espaces restent strictement séparés sans lien croisé trompeur", () => {
    expect(home).toContain('href="/professionnels"');
    expect(home).toContain('href="/artisan"');
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
  it("les cartes de secteurs sont cliquables et pré-sélectionnent le profil dans le formulaire", () => {
    expect(pro).toContain("pro-sector-clickable");
    expect(pro).toContain("Demander pour ce profil");
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
