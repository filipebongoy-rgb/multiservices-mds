# MULTISERVICES MDS — Livraison : correctifs héro d'accueil, bandeau de suivi et débordement mobile

**Date :** 6 novembre 2026  
**Demande initiale :**  
> *« c'est quoi ça ? c'est visible par tout les nouveaux utilisateurs et l'image de fond fait qu'on ne voit plus les écritures et cela fait un site amateur et non maîtrisé, et rien à voir avec la maquette... puis en bas de la page obligé de décaler pour voir »*

**Capture 1 :** un bandeau orange « Travaux terminés : vérifiez les photos » apparaît pour tous les visiteurs avec « + 12 autres demandes en cours » ; le héro affiche du texte blanc par-dessus un prospectus tarifaire bleu illisible.  
**Capture 2 :** en bas de la page, les cartes « Espace professionnel » et « Accès réservé : vous êtes l'artisan » débordent hors de l'écran, coupées à droite.

---

## 1. Ce qui a été corrigé

### a) Le fond d'image illisible du héro est supprimé
L'image utilisée précédemment était un prospectus tarifaire (« TARIFS RECHERCHE DE FUITE », « 110 € »…), ce qui rendait le texte blanc du héro totalement illisible et donnait une impression « amateur et non maîtrisé », loin de la maquette noire/épurée. Le héro est désormais :
- une **carte sombre contenue** (anthracite, texte blanc net, CTA orange « Demander un devis gratuit → »)
- sur desktop, le **vrai logo officiel MDS** apparaît dans une carte visuelle discrète à droite avec le sceau *« Artisan de confiance »*
- **0 artefact IA** : aucune image de fond busy, le rendu est net et professionnel comme sur la maquette

### b) Le bandeau « commande en cours » ne s'affiche plus pour l'artisan
La procédure `requests.mine` filtrait avec un passe-droit pour l'administrateur, ce qui renvoyait **tous les dossiers du système** et déclenchait le bandeau pour le propriétaire avec les demandes de test. Elle filtre désormais strictement par **propriété/appartenance** (`listClientScoped`) : un client ne voit que ses propres demandes, et l'artisan administrateur ne voit plus le bandeau de suivi sur l'accueil.

### c) Fin du débordement horizontal (« obligé de décaler pour voir »)
- `overflow-x: hidden` sur `html` et `body`
- suppression du `white-space: nowrap` de la carte artisan
- largeurs fluides et repli en colonne sur petit écran pour les cartes pro et artisan
- tout le contenu reste désormais dans la largeur de l'écran

---

## 2. Vérifications

| Contrôle | Résultat |
|---|---|
| TypeScript (`pnpm check`) | **0 erreur** |
| Tests automatisés (`pnpm test`) | **297/297 passants** sur 13 fichiers |
| Compilation production (`pnpm build`) | **OK** |
| Santé serveur | **HTTP 200** sur `/api/health` |
| Les 10 routes déclarées | **Toutes HTTP 200** |
| Tests ciblés | `requests.mine` exige une authentification et renvoie uniquement les propres demandes de l'utilisateur (même pour l'admin) ; test héro contenue sans photo de fond |

---

## 3. Fichiers modifiés

- `client/src/pages/Home.tsx` — héro sombre contenu, zéro photo de fond
- `client/src/components/mds/simple-ux.css` — styles héro contenu + cartes fluides
- `client/src/index.css` — `overflow-x: hidden`
- `server/mds/requests.ts` — `listClientScoped` pour `requests.mine`
- `server/mds/router.test.ts` — tests mine
- `server/mds/ui-version.test.ts` — test héro
- `docs/CONTINUITE.md` — journal mis à jour
- suppression de `hero-artisan*.webp` devenues inutiles
