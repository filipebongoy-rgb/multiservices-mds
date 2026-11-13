import { readFileSync } from "node:fs";
import path from "node:path";
const titles: Record<string, string> = {
  "/": "Vos travaux, simplement",
  "/prestations": "Trouver une prestation",
  "/demande": "Déposer une demande",
  "/suivi": "Suivre ma demande",
  "/paiements": "Mes paiements",
  "/professionnels": "Espace professionnel",
  "/portfolio": "Réalisations MDS",
  "/reseau": "Réseau MDS",
  "/plombier-rennes": "Plombier à Rennes — dépannage et travaux à domicile",
  "/electricien-rennes": "Électricien à Rennes — dépannage et installation",
  "/chauffagiste-rennes": "Chauffagiste à Rennes — chauffage et radiateurs",
  "/peintre-rennes": "Peintre à Rennes — peinture intérieure et rénovation",
  "/petits-travaux-rennes": "Petits travaux à Rennes — artisan multiservices",
  "/artisan": "Espace artisan",
  "/profil": "Mon profil",
  "/connexion": "Connexion",
  "/confidentialite": "Confidentialité",
  "/mentions-legales": "Mentions légales",
  "/artisan/assistant": "Assistant — Espace artisan",
  "/artisan/demandes": "Demandes — Espace artisan",
  "/artisan/requests": "Demandes — Espace artisan",
  "/artisan/planning": "Planning — Espace artisan",
  "/artisan/interventions": "Interventions — Espace artisan",
  "/artisan/settlements": "Mes règlements — Espace artisan",
  "/artisan/activity": "Activité — Espace artisan",
  "/artisan/team": "Équipe — Espace artisan",
};
const descriptions: Record<string, string> = {
  "/": "Trouvez un artisan local à Rennes pour plomberie, électricité, chauffage, peinture et petits travaux. Décrivez votre besoin et recevez une réponse MDS.",
  "/prestations":
    "Recherchez une prestation validée par MDS ou envoyez une demande libre pour vos réparations, travaux et besoins de maintenance.",
  "/portfolio":
    "Découvrez les réalisations MDS, les photos avant et après disponibles avec accord client et les avis vérifiés à Rennes.",
  "/reseau":
    "Partagez MULTISERVICES MDS à Rennes, envoyez une demande et recommandez un artisan local sans exposer les dossiers privés.",
  "/plombier-rennes": "Plombier à Rennes pour fuite d’eau, débouchage, robinet, lavabo, douche et chauffe-eau. Demande simple à domicile avec MULTISERVICES MDS.",
  "/electricien-rennes": "Électricien à Rennes pour panne, prises, éclairage, tableau électrique, disjoncteur et VMC. Décrivez votre besoin à MULTISERVICES MDS.",
  "/chauffagiste-rennes": "Chauffagiste à Rennes pour radiateur en panne, chaudière, thermostat et entretien du chauffage. Demande rapide avec MULTISERVICES MDS.",
  "/peintre-rennes": "Peintre à Rennes pour murs, plafonds, rebouchage, ponçage et rénovation intérieure. Demandez un devis peinture avec MULTISERVICES MDS.",
  "/petits-travaux-rennes": "Petits travaux à Rennes : montage de meubles, fixation d’étagère, pose de tringle, réparation de porte et bricolage à domicile.",
  "/confidentialite":
    "Découvrez quelles informations sont conservées par MULTISERVICES MDS et comment sont protégés vos dossiers et vos pièces jointes.",
};
const ARTISAN_ROUTE =
  /^\/artisan(?:\/(assistant|requests|demandes|planning|interventions|settlements|activity|team)(?:\/\d+)?)?$/;
function artisanPageTitle(pathname: string): string | null {
  const m = pathname.match(
    /^\/artisan\/(requests|demandes|interventions)\/(\d+)$/
  );
  if (!m) return null;
  return (
    (m[1] === "interventions"
      ? "Fiche intervention"
      : "Dossier de demande") +
    " n° " +
    m[2] +
    " — Espace artisan"
  );
}
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );
}
export function publicPageHtml(
  template: string,
  pathname: string,
  publicDir: string
) {
  const title =
    (artisanPageTitle(pathname) || titles[pathname] || "Page introuvable") +
    " — MULTISERVICES MDS";
  const description =
    descriptions[pathname] ||
    "MULTISERVICES MDS — demandes, suivi et espaces sécurisés pour vos interventions.";
  const indexable =
    pathname === "/" ||
    pathname === "/prestations" ||
    pathname === "/portfolio" ||
    pathname === "/reseau" ||
    pathname.endsWith("-rennes") ||
    pathname === "/confidentialite" ||
    pathname === "/mentions-legales";
  let body = "";
  try {
    body =
      JSON.parse(readFileSync(path.join(publicDir, "prerender.json"), "utf8"))[
        pathname
      ] || "";
  } catch {}
  const origin = "https://mdsservices-73dc9ex8.manus.space";
  const canonical = origin + (pathname === "/" ? "/" : pathname);
  const keywords: Record<string, string> = {
    "/plombier-rennes": "plombier Rennes, dépannage plomberie, fuite d’eau, débouchage WC, robinet, chauffe-eau",
    "/electricien-rennes": "électricien Rennes, dépannage électrique, panne électrique, prise, luminaire, VMC",
    "/chauffagiste-rennes": "chauffagiste Rennes, radiateur en panne, chaudière, thermostat, entretien chauffage",
    "/peintre-rennes": "peintre Rennes, peinture intérieure, peinture plafond, enduit mural, rénovation appartement",
    "/petits-travaux-rennes": "petits travaux Rennes, bricoleur à domicile, montage meubles, fixation étagère, artisan multiservices",
  };
  return template
    .replace(/<title>[^<]*<\/title>/, "<title>" + escape(title) + "</title>")
    .replace(
      /<meta name="description"[^>]*>/,
      '<meta name="description" content="' + escape(description) + '" />'
    )
    .replace(
      "</head>",
      '<meta name="robots" content="' +
        (indexable ? "index, follow" : "noindex, nofollow") +
        '" /><meta name="referrer" content="strict-origin-when-cross-origin" /><meta property="og:type" content="website" /><meta property="og:site_name" content="MULTISERVICES MDS" /><meta property="og:title" content="' +
        escape(title) +
        '" /><meta property="og:description" content="' +
        escape(description) +
        '" /><meta name="keywords" content="' +
        escape(keywords[pathname] || "artisan Rennes, dépannage à domicile, petits travaux, devis travaux") +
        '" /><link rel="canonical" href="' +
        escape(canonical) +
        '" /><meta property="og:url" content="' +
        escape(canonical) +
        '" /><meta property="og:image" content="' +
        escape(origin + "/mds-logo-320.png") +
        '" /><meta name="twitter:card" content="summary" /><meta name="twitter:title" content="' +
        escape(title) +
        '" /><meta name="twitter:description" content="' +
        escape(description) +
        '" /></head>'
    )
    .replace('<div id="root"></div>', '<div id="root">' + body + "</div>");
}
export function isPageRoute(pathname: string) {
  return pathname in titles || ARTISAN_ROUTE.test(pathname);
}
