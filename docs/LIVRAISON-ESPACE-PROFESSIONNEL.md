# MULTISERVICES MDS — Livraison : refonte de l'espace professionnel avec offre contrats d'entretien & abonnements

**Date :** 6 novembre 2026  
**Demande initiale :**  
> *« quand je clique sur professionnel je suis mal rediriger car je tombe sur l'espace de l'artisan et non exclusivement pour les professionnels mairie, HLM et autres professionnels, hôpital, écoles, centre commercial, possibilité de faire un contrat sur forme d'abonnement mensuel ou annuel avec des tarifs adapté et une petite réduction pour attirer un maximum d'intéressé »*

**Origine du diagnostic :** vidéo fournie par l'utilisateur (`SVID_20261106_001505_1.mp4`), analysée via l'outil d'analyse vidéo Manus.

---

## 1. Ce qui a été compris et corrigé

### Analyse du problème observé

L'analyse détaillée de la vidéo montre :

1. Sur l'accueil du site, l'utilisateur a cliqué sur la carte du bas **« Vous êtes l'artisan MDS ? »** (ou a voulu cliquer dessus alors qu'une zone proche déclenchait l'autre carte).
2. L'écran suivant affichait de façon inattendue le titre **« ESPACE PROFESSIONNEL »** avec un formulaire de connexion et un exemple de bâtiment.
3. L'utilisateur a cliqué **« Se connecter avec Manus »** : après authentification OAuth, le compte artisan (rôle administrateur) a été **automatiquement redirigé vers `/artisan`** (espace artisan privé), car c'est la destination par défaut des administrateurs.
4. Résultat : l'utilisateur a perçu une **mauvaise redirection**, l'impression d'atterrir « sur l'espace de l'artisan et non sur un espace exclusivement pour les professionnels », d'autant que la page professionnelle elle-même **ne contenait aucune offre commerciale** (aucun secteur cité, aucune formule de contrat, aucun tarif).

### Correctifs appliqués

| Problème | Correction |
|---|---|
| Cartes d'accès confondues sur l'accueil | La carte pro porte l'identité **orange MDS** avec texte enrichi ; la carte artisan devient **discrète et grisée** (« Accès réservé : vous êtes l'artisan MDS ? »), 28 px de séparation |
| Pas d'offre pro visible | Nouvelle page publique `/professionnels` avec **7 secteurs ciblés**, **3 formules d'abonnement**, **ce qui est inclus**, **explication tarifaire avec réduction annuelle** |
| Confusion entre les deux espaces | L'écran artisan déconnecté renvoie vers `/professionnels` ; l'espace pro renvoie vers `/artisan` |
| Les pros ne pouvaient pas déclarer sans connexion | L'offre et le **formulaire de demande de contrat** sont 100 % publics (aucune connexion requise) |
| Bug backend des demandes libres | Les demandes libres et les demandes de contrat pro peuvent désormais être créées sans créneau même avec calendrier activé |

---

## 2. Contenu de la nouvelle offre professionnelle

La page **/professionnels** comprend désormais deux onglets :

### Onglet 1 — « Offre professionnels & contrats » (public)

- **7 secteurs ciblés avec icônes et descriptions** :
  1. Mairies & collectivités territoriales (bâtiments communaux, écoles, médiathèques)
  2. Bailleurs sociaux & organismes HLM (logements collectifs, parties communes, résidences)
  3. Syndics & gestionnaires de copropriétés (immeubles, locaux poubelles, parkings)
  4. Hôpitaux, cliniques & établissements de santé (maintenance courante, réactivité)
  5. Écoles, crèches & établissements scolaires (sanitaires, électricité, sécurité)
  6. Centres commerciaux, galeries & commerces (sanitaires clients, maintenance continue)
  7. Entreprises, bureaux & locaux professionnels (petits travaux, entretien)
- **3 formules d'abonnement** :
  - **Formule Mensuelle** : abonnement sans engagement annuel, résiliable avec préavis court, tarif adapté par bâtiment/lot
  - **Formule Annuelle (recommandée — badge « Tarif réduit »)** : engagement 12 mois avec **remise d'engagement**, visites de contrôle programmées, maintenance préventive
  - **Formule Sur-mesure Grands Comptes** : hôpitaux, centres commerciaux, multi-sites — délais contractuels (SLA), devis personnalisé
- **Ce qui est inclus** : priorité d'intervention, contact unique pour les 5 corps de métier (plomberie, électricité, chauffage, peinture, petits travaux/maintenance), facturation unique mensuelle ou annuelle, **preuves obligatoires (photos avant/après + signatures)**, pas de marketplace — toujours MDS, zone Rennes + 30 km
- **Explication tarifaire transparente** : tarif dimensionné au parc (bâtiments, logements, m²), remise d'engagement sur l'annuel, devis gratuits et sans engagement
- **Formulaire de demande de proposition de contrat** : organisation, secteur, parc estimé, formule souhaitée, coordonnées — la demande arrive directement dans la liste **« Demandes »** de l'artisan avec priorité « À analyser » et badge « Action requise » (avec push propriétaire immédiat)
- **Contacts directs** : 06 04 15 99 16 et contact@multiservices-mds.fr

### Onglet 2 — « Mon espace organisation » (réservé aux clients connectés)

- Connexion requise : un panneau explicatif avec le bouton « Se connecter avec Manus »
- Après connexion : gestion complète des **organisations**, **bâtiments déclarés**, **interventions en cours**, **devis** et **factures** (comportement professionnel déjà existant, 100 % conservé)

---

## 3. Parcours d'accès clarifié

| Utilisateur | Ce qu'il voit | Ce qu'il fait |
|---|---|---|
| **Visiteur pro** (mairie, HLM…) | Page pro publique avec toute l'offre et les formules | Remplit la demande de contrat ou appelle le 06 04 15 99 16 |
| **Client pro déjà inscrit** | Même page → onglet « Mon espace organisation » → connexion | Retrouve ses bâtiments et ses interventions |
| **Artisan MDS** | Voit « Voir le site public » / « Espace professionnel » dans ses menus | Navigue librement ; son atelier reste sur `/artisan` |
| **Visiteur perdu** | Les deux écrans portent une passerelle vers l'autre espace | Ne peut plus atterrir au mauvais endroit sans issue |

---

## 4. Vérifications effectuées

| Contrôle | Résultat |
|---|---|
| `pnpm check` (TypeScript) | **0 erreur** |
| `pnpm test` | **281/281 passants** (13 fichiers, dont 16 tests UI pro et 2 tests de demande libre) |
| `pnpm build` | **OK** (assets pro : `Professional-DVl8SYHi.js` 60 kB) |
| `/api/health` | **HTTP 200** |
| 10 routes déclarées | **Toutes HTTP 200** |
| Création réelle d'une demande de contrat via API | **HTTP 200 — créée avec succès sans créneau** |
| Site publié | `https://mdsservices-73dc9ex8.manus.space` |

---

## 5. Fichiers modifiés

- `client/src/pages/Professional.tsx` — réécriture complète (offre + workspace)
- `client/src/pages/Home.tsx` — enrichissement des deux cartes pro
- `client/src/pages/Artisan.tsx` — passerelle vers l'espace pro
- `client/src/components/mds/simple-ux.css` — styles de l'offre pro et différenciation des cartes
- `server/mds/requests.ts` — autorisation des demandes libres sans créneau avec calendrier activé
- `server/mds/ui-version.test.ts` — 16 assertions de non-régression de l'offre pro
- `server/mds/router.test.ts` — 2 tests de demande libre sans créneau
- `docs/CONTINUITE.md` — journal de continuité mis à jour
