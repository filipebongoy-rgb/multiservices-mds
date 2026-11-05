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
