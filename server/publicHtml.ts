import { readFileSync } from "node:fs";
import path from "node:path";
const titles: Record<string, string> = {
  "/": "Vos travaux, simplement",
  "/prestations": "Trouver une prestation",
  "/demande": "Déposer une demande",
  "/suivi": "Suivre ma demande",
  "/paiements": "Mes paiements",
  "/professionnels": "Espace professionnel",
  "/artisan": "Espace artisan",
  "/profil": "Mon profil",
  "/confidentialite": "Confidentialité",
  "/mentions-legales": "Mentions légales",
};
const descriptions: Record<string, string> = {
  "/": "Décrivez votre besoin de réparation ou de travaux à MDS. Votre artisan vous propose des conditions ; vous confirmez avant toute intervention.",
  "/prestations":
    "Recherchez une prestation validée par MDS ou envoyez une demande libre pour vos réparations, travaux et besoins de maintenance.",
  "/confidentialite":
    "Découvrez quelles informations sont conservées par MULTISERVICES MDS et comment sont protégés vos dossiers et vos pièces jointes.",
};
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
    (titles[pathname] || "Page introuvable") + " — MULTISERVICES MDS";
  const description =
    descriptions[pathname] ||
    "MULTISERVICES MDS — demandes, suivi et espaces sécurisés pour vos interventions.";
  const indexable =
    pathname === "/" ||
    pathname === "/prestations" ||
    pathname === "/confidentialite" ||
    pathname === "/mentions-legales";
  let body = "";
  try {
    body =
      JSON.parse(readFileSync(path.join(publicDir, "prerender.json"), "utf8"))[
        pathname
      ] || "";
  } catch {}
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
        '" /><meta name="twitter:card" content="summary" /></head>'
    )
    .replace('<div id="root"></div>', '<div id="root">' + body + "</div>");
}
export function isPageRoute(pathname: string) {
  return pathname in titles;
}
