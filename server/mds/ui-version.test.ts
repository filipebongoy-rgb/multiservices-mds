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
  it("chaque ligne de demande ouvre directement le dossier au toucher", () => {
    const assistant = readFileSync(new URL("../../client/src/components/mds/private-assistant.tsx", import.meta.url), "utf8");
    expect(assistant).toContain('role={task.requestId ? "button" : undefined}');
    expect(assistant).toContain("onOpenRequest(task.requestId)");
  });
  it("la liste des demandes artisan se masque sur mobile dès qu'un dossier est sélectionné", () => {
    expect(requests).toContain("artisan-list-panel");
    expect(requests).toContain("artisan-list-panel--hidden-mobile");
    expect(css).toContain("display: none");
  });
  it("le panneau de détail de dossier s'affiche uniquement avec une sélection sur mobile", () => {
    expect(requests).toContain("artisan-detail-panel--hidden-mobile");
  });
  it("la sélection ouvre directement le panneau détail et y défile sur mobile", () => {
    expect(requests).toContain("detailRef");
    expect(requests).toContain("scrollIntoView");
    expect(requests).toContain('block: "start"');
  });
  it("le dossier propose un bouton explicite de retour à la liste", () => {
    expect(requests).toMatch(/Retour à la liste des\s*demandes/s);
  });
  it("remplace l’acceptation bloquée par une action devis utilisable", () => {
    expect(requests).toContain('onClick={() => setAction("quote")}');
    expect(requests).toContain("Préparer le devis");
    expect(requests).toContain("Un devis distinct doit être accepté");
  });
  it("l'onglet Interventions adopte le même comportement master-detail avec sélection visible", () => {
    expect(artisan).toContain("select(request.id)");
    expect(artisan).toContain("4px solid #bc4c23");
  });
  it("garde la barre artisan visible dès l’ouverture sur mobile", () => {
    expect(css).toContain("@media (max-width: 900px), (pointer: coarse)");
    expect(css).toContain(".artisan-mobile-bar {\n    position: fixed;");
    expect(css).toContain(".private-workspace {\n    padding-bottom:");
  });
  it("ouvre chaque espace artisan sur une route dédiée et regroupe les derniers accès dans Plus", () => {
    const app = readFileSync(new URL("../../client/src/App.tsx", import.meta.url), "utf8");
    const manifest = readFileSync(new URL("../../public/manus-routes.json", import.meta.url), "utf8");
    const layoutSrc = readFileSync(new URL("../../client/src/components/mds/Layout.tsx", import.meta.url), "utf8");
    expect(app).toContain('path="/artisan/:section"');
    expect(app).toContain('path="/artisan/:section/:id"');
    expect(artisan).toContain('setLocation(`/artisan/${item.id}`)');
    expect(artisan).toContain('aria-label="Autres espaces artisan"');
    expect(css).toContain("grid-template-columns: repeat(5, minmax(0, 1fr));");
    expect(artisan).toContain("artisan-fiche-page");
    expect(artisan).toContain("artisan-fiche-bar");
    expect(artisan).toContain("artisan-fiche-back");
    expect(requests).toContain("artisan-fiche-actions");
    expect(requests).toContain("backLabel");
    expect(manifest).toContain('"/artisan/requests/:id"');
    expect(manifest).toContain('"/artisan/interventions/:id"');
    expect(layoutSrc).toContain('location.startsWith("/artisan")');
  });
  it("garde l’assistante compacte et propose un retrait réversible des dossiers terminés", () => {
    const assistant = readFileSync(new URL("../../client/src/components/mds/private-assistant.tsx", import.meta.url), "utf8");
    const requestsServer = readFileSync(new URL("./requests.ts", import.meta.url), "utf8");
    expect(assistant).toContain("assistant-quick-panel");
    expect(assistant).toContain("Préparer la relance");
    expect(assistant).toContain("assistant-history-details");
    expect(requests).toContain("requests.archive");
    expect(requestsServer).toContain('confirmation: z.literal("SUPPRIMER")');
    expect(requestsServer).toContain("deletedAt: new Date()");
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
  it("impose un e-mail et une confirmation de mot de passe à l’inscription", () => {
    expect(auth).toContain('label="Adresse e-mail"');
    expect(auth).toContain('autoComplete="email"');
    expect(auth).toContain("login.mutate({ email, password })");
    expect(auth).toContain('label="Confirmer le mot de passe"');
    expect(auth).toContain("passwordConfirmation");
    expect(auth).toContain("Les deux mots de passe doivent être identiques.");
  });
  it("protège aussi le changement de mot de passe dans le profil", () => {
    const profile = readFileSync(
      new URL("../../client/src/pages/Profile.tsx", import.meta.url),
      "utf8"
    );
    expect(profile).toContain("Confirmer le nouveau mot de passe");
    expect(profile).toContain("newPasswordConfirmation");
    expect(profile).toContain(
      "Les deux nouveaux mots de passe doivent être identiques."
    );
  });
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
  it("propose visibilité du mot de passe, reset à usage unique et accès artisan", () => {
    expect(auth).toContain("showPassword");
    expect(auth).toContain("Mot de passe oublié ?");
    expect(auth).toContain("requestReset.mutate({ email })");
    expect(auth).toContain("resetPassword.mutate");
    expect(localAuth).toContain("localPasswordResets");
    expect(localAuth).toContain("PASSWORD_RESET_TTL_MS");
    expect(localAuth).toContain("usedAt");
  });
  it("affiche une action rapide connexion ou déconnexion dans l’en-tête", () => {
    const layout = readFileSync(
      new URL("../../client/src/components/mds/Layout.tsx", import.meta.url),
      "utf8"
    );
    expect(layout).toContain("simple-auth-quick-action");
    expect(layout).toContain('user ? "Se déconnecter" : "Se connecter"');
    expect(layout).toContain("Accès artisan");
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
    expect(artisan).toContain("<ArtisanLocationsMap");
    expect(artisan).toContain("onOpen={openRequest}");
  });
});

describe("lisibilité mobile de la demande", () => {
  it("sépare le retour, le header et le titre de contenu sur mobile", () => {
    const css = readFileSync(
      new URL("../../client/src/components/mds/simple-ux.css", import.meta.url),
      "utf8"
    );
    const layout = readFileSync(
      new URL("../../client/src/components/mds/Layout.tsx", import.meta.url),
      "utf8"
    );
    expect(css).toContain(".simple-header.is-request .simple-request-title");
    expect(css).toContain(
      ".simple-header.is-request .simple-auth-quick-action"
    );
    expect(css).toContain(".request-simple .page-title");
    expect(layout).not.toContain("simple-request-title");
    expect(css).toContain(".site-header.simple-header.is-request");
  });
  it("ne mélange pas l’espace professionnel client avec l’atelier artisan", () => {
    const layout = readFileSync(
      new URL("../../client/src/components/mds/Layout.tsx", import.meta.url),
      "utf8"
    );
    const professional = readFileSync(
      new URL("../../client/src/pages/Professional.tsx", import.meta.url),
      "utf8"
    );
    expect(layout).toContain(
      'const privateWorkspace = !!user && location === "/artisan";'
    );
    expect(professional).toContain('auth.user?.role === "admin"');
    expect(professional).toContain("Accéder à l’atelier");
  });
  it("affiche une prochaine action et un rafraîchissement explicite", () => {
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    expect(artisan).toContain("Prochaine action");
    expect(artisan).toContain("Ouvrir le dossier");
    expect(artisan).toContain("Actualisation…");
    expect(artisan).toContain("Traiter cette demande urgente");
  });
  it("surveille les nouvelles demandes urgentes sans alerte initiale répétée", () => {
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    expect(artisan).toContain("refetchInterval: 10_000");
    expect(artisan).toContain("knownUrgentIds");
    expect(artisan).toContain("Nouvelle demande urgente");
    expect(artisan).toContain('role="alert"');
    expect(artisan).toContain("Ouvrir");
  });
  it("géolocalise les lieux urgents sans simuler la position", () => {
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
    expect(map).toContain("Urgentes uniquement");
    expect(map).toContain("navigator.geolocation.getCurrentPosition");
    expect(map).toContain("Ma position");
    expect(map).toContain('request.answers?.__urgency === "urgent"');
    expect(map).toContain("Votre position");
    expect(map).toContain("focusUrgent");
    expect(artisan).toContain("Voir sur la carte");
    expect(artisan).toContain("setUrgentMapOnly(true)");
  });
});

describe("prestations VMC et sécurité incendie", () => {
  it("expose installation et entretien de VMC et de détecteurs de fumée", () => {
    const shared = readFileSync(
      new URL("../../shared/mds.ts", import.meta.url),
      "utf8"
    );
    expect(shared).toContain("Installation de VMC");
    expect(shared).toContain("Entretien de VMC");
    expect(shared).toContain("Installation de détecteur de fumée");
    expect(shared).toContain("Entretien de détecteur de fumée");
  });
});


describe("carte publique de zone d’intervention", () => {
  it("branche une carte interactive avec recherche et géolocalisation volontaire", () => {
    const home = readFileSync(new URL("../../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const map = readFileSync(new URL("../../client/src/components/mds/ServiceAreaMap.tsx", import.meta.url), "utf8");
    expect(home).toContain("ServiceAreaMap");
    expect(map).toContain("mapboxgl.Map");
    expect(map).toContain("api.mapbox.com/geocoding");
    expect(map).toContain("navigator.geolocation");
    expect(map).toContain("30");
  });
});

describe("analyse artisan des demandes clients", () => {
  it("expose des indicateurs d’aide à la décision sans suivi de navigation caché", () => {
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    const admin = readFileSync(
      new URL("../../server/mds/admin.ts", import.meta.url),
      "utf8"
    );
    expect(artisan).toContain("Comprendre les demandes clients");
    expect(artisan).toContain("Clients récurrents");
    expect(artisan).toContain("surveillance des pages consultées");
    expect(admin).toContain("serviceDemand");
    expect(admin).toContain("conversionRate");
    expect(admin).toContain("recentActivity");
  });
});

describe("compteur réel de visites", () => {
  it("enregistre l’accueil côté serveur et déduplique une empreinte par jour", () => {
    const home = readFileSync(
      new URL("../../client/src/pages/Home.tsx", import.meta.url),
      "utf8"
    );
    const server = readFileSync(
      new URL("../../server/_core/index.ts", import.meta.url),
      "utf8"
    );
    const schema = readFileSync(
      new URL("../../drizzle/schema.ts", import.meta.url),
      "utf8"
    );
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    expect(home).toContain('fetch("/api/site-visit"');
    expect(server).toContain("siteVisits");
    expect(server).toContain("visitorHash");
    expect(server).toContain("ER_DUP_ENTRY");
    expect(schema).toContain("site_visits_visitor_day");
    expect(artisan).toContain("Visiteurs du site");
  });
});

describe("accueil et actions de suivi", () => {
  it("utilise la carte comme source unique de la zone d’intervention", () => {
    const home = readFileSync(
      new URL("../../client/src/pages/Home.tsx", import.meta.url),
      "utf8"
    );
    expect(home).toContain("<ServiceAreaMap />");
    expect(home).not.toContain("home-location-bar");
  });
  it("place la carte après les accès et le contenu principal de l’accueil", () => {
    const home = readFileSync(
      new URL("../../client/src/pages/Home.tsx", import.meta.url),
      "utf8"
    );
    expect(home.indexOf('href="/demande"')).toBeLessThan(
      home.indexOf("<ServiceAreaMap />")
    );
    expect(home.indexOf('href="/professionnels"')).toBeLessThan(
      home.indexOf("<ServiceAreaMap />")
    );
  });
  it("déclare explicitement les deux soumissions du suivi", () => {
    const tracking = readFileSync(
      new URL("../../client/src/pages/Tracking.tsx", import.meta.url),
      "utf8"
    );
    expect(tracking).toContain('<button type="submit" className="btn primary">');
    expect(tracking).toContain(
      '<button type="submit" className="btn primary" disabled={act.isPending}>'
    );
  });
});

describe("explication des blocages de workflow", () => {
  it("explique au client les informations manquantes avant l’envoi", () => {
    const request = readFileSync(
      new URL("../../client/src/pages/Request.tsx", import.meta.url),
      "utf8"
    );
    expect(request).toContain("submitBlockers");
    expect(request).toContain("Pour envoyer la demande, complétez");
    expect(request).toContain('"request-submit-help"');
  });
  it("explique à l’artisan la pause pendant une mutation", () => {
    const requests = readFileSync(
      new URL("../../client/src/components/mds/private-artisan-requests.tsx", import.meta.url),
      "utf8"
    );
    expect(requests).toContain("Enregistrement de l’action en cours");
    expect(requests).toContain("Préparer le devis");
  });
});

describe("disponibilités artisan synchronisées", () => {
  it("permet l’enregistrement manuel et confirme la synchronisation client", () => {
    const calendar = readFileSync(
      new URL("../../client/src/components/mds/private-calendar.tsx", import.meta.url),
      "utf8"
    );
    expect(calendar).toContain("calendarSettingsSchema.safeParse(draft)");
    expect(calendar).toContain("Enregistrer et synchroniser le planning");
    expect(calendar).toContain("créneaux clients synchronisés");
    expect(calendar).toContain("servent directement au calcul des créneaux");
  });
});

describe("notification de réservation", () => {
  it("traite la file après le commit de confirmation client", () => {
    const requests = readFileSync(
      new URL("./requests.ts", import.meta.url),
      "utf8"
    );
    expect(requests).toContain('if (input.action === "confirm") await flushBookingNotifications(db)');
    expect(requests).toContain("La transaction de réservation est déjà validée");
    expect(requests).toContain('import { processOutbox } from "./outbox"');
  });
});

describe("alerte téléphone d’affectation artisan", () => {
  it("demande la permission et détecte une affectation nouvelle rapidement", () => {
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    expect(artisan).toContain("Notification.requestPermission");
    expect(artisan).toContain("refetchInterval: 5_000");
    expect(artisan).toContain('item.title === "Nouvelle intervention affectée"');
    expect(artisan).toContain("new window.Notification");
    expect(artisan).toContain("Activer les alertes téléphone");
  });
});


describe("assistante opérationnelle artisan", () => {
  it("affiche un poste de pilotage branché sur les données réelles", () => {
    const artisan = readFileSync(
      new URL("../../client/src/pages/Artisan.tsx", import.meta.url),
      "utf8"
    );
    const assistant = readFileSync(
      new URL("../../client/src/components/mds/private-assistant.tsx", import.meta.url),
      "utf8"
    );
    const server = readFileSync(
      new URL("./assistant.ts", import.meta.url),
      "utf8"
    );
    expect(artisan).toContain('id: "assistant"');
    expect(artisan).toContain("<ArtisanAssistant");
    expect(artisan).toContain("/artisan/requests/${id}");
    expect(artisan).toContain("parseArtisanRoute");
    expect(artisan).toContain('rawSection === "demandes" ? "requests" : rawSection');
    expect(assistant).toContain("Missions et actions");
    expect(assistant).toContain("La mission la plus importante est affichée juste en dessous.");
    expect(assistant).toContain("À faire maintenant");
    expect(assistant).toContain("Ouvrir la mission");
    expect(assistant).toContain("Valider et envoyer");
    expect(assistant).toContain("L’assistante prépare, vous validez");
    expect(assistant).toContain("Parler à l’assistante");
    expect(assistant).toContain("ouvre les demandes");
    expect(assistant).toContain("prépare une relance");
    expect(assistant).toContain("SpeechRecognition");
    expect(assistant).toContain('aria-label="Actions rapides"');
    expect(assistant).toContain("Voir les ${data.tasks.length - 3} autres missions");
    expect(assistant).toContain("window.confirm");
    expect(server).toContain("assistantRouter");
    expect(server).toContain("processOutbox");
    expect(server).toContain('model: assistantModel');
    expect(server).toContain("La carte du client a été refusée par sa banque");
    expect(server).toContain("paymentReason");
  });

  it("conserve les brouillons et interdit un envoi implicite", () => {
    const schema = readFileSync(
      new URL("../../drizzle/schema.ts", import.meta.url),
      "utf8"
    );
    const assistant = readFileSync(
      new URL("./assistant.ts", import.meta.url),
      "utf8"
    );
    expect(schema).toContain("mds_assistant_actions");
    expect(schema).toContain('"proposed"');
    expect(assistant).toContain('status: "proposed"');
    expect(assistant).toContain('if (action.status !== "proposed")');
    expect(assistant).toContain('assistant.approve');
  });
});

describe("agent vocal propriétaire MDS", () => {
  it("prépare les routes Twilio sans activer d’appel sans secrets", () => {
    const voice = readFileSync(new URL("./voice-agent.ts", import.meta.url), "utf8");
    const server = readFileSync(new URL("../_core/index.ts", import.meta.url), "utf8");
    const schema = readFileSync(new URL("../../drizzle/schema.ts", import.meta.url), "utf8");
    expect(server).toContain("registerVoiceRoutes");
    expect(voice).toContain("/api/voice/incoming");
    expect(voice).toContain("/api/voice/respond");
    expect(voice).toContain("X-Twilio-Signature");
    expect(voice).toContain("MDS_TWILIO_AUTH_TOKEN");
    expect(schema).toContain("mds_voice_call_logs");
  });
});

describe("confirmation autonome des rendez-vous", () => {
  it("expose une action bornée par le calendrier et le prix contractuel", () => {
    const assistant = readFileSync(new URL("./assistant.ts", import.meta.url), "utf8");
    const requests = readFileSync(new URL("./requests.ts", import.meta.url), "utf8");
    expect(assistant).toContain("autoConfirmRequest");
    expect(assistant).toContain("Confirmer le rendez-vous prêt");
    expect(requests).toContain("export async function autoConfirmRequest");
    expect(requests).toContain("requireContractPrice(r, r.proposedPriceCents)");
    expect(requests).toContain("checkCalendar(tx, times, r)");
    expect(requests).toContain('"assistant:autoConfirm"');
  });
});
