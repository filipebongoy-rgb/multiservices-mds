import React from "react";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { writeFileSync, mkdirSync } from "node:fs";
import Home from "../client/src/pages/Home";
import { Privacy } from "../client/src/pages/Legal";
import { trades } from "../shared/mds";
const pages: Record<string, string> = {
  "/": renderToString(
    <Router ssrPath="/">
      <Home />
    </Router>
  ),
  "/confidentialite": renderToString(
    <Router ssrPath="/confidentialite">
      <Privacy />
    </Router>
  ),
  "/prestations": renderToString(
    <main className="page-shell standard-page">
      <h1>De quoi avez-vous besoin ?</h1>
      <p>
        Choisissez une prestation validée par MDS, ou décrivez simplement votre
        problème. Les offres ouvertes sont chargées depuis le catalogue actuel.
      </p>
      <h2>Les métiers, au même endroit</h2>
      <ul>
        {trades.map(t => (
          <li key={t.slug}>
            <a href={"/prestations?metier=" + t.slug}>{t.name}</a> — {t.short}
          </li>
        ))}
      </ul>
      <p>
        Ces familles organisent le catalogue et ne signifient pas que toutes les
        prestations sont proposées. MDS valide chaque prestation avant
        ouverture.
      </p>
      <a href="/demande">
        Je ne trouve pas mon problème — envoyer une demande libre
      </a>
      <p>
        Une demande n’est pas une réservation définitive. MDS vous propose des
        conditions, puis vous confirmez le tarif et le créneau.
      </p>
    </main>
  ),
};
mkdirSync("client/public", { recursive: true });
writeFileSync("client/public/prerender.json", JSON.stringify(pages));
console.log("Rendu initial préparé pour " + Object.keys(pages).join(", "));
