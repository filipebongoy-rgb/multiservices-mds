# MULTISERVICES MDS — Livraison : correctif d'ouverture des dossiers sur mobile & documentation d'accès équipe

**Date :** 6 novembre 2026  
**Demande initiale :** *« je clique et rien se passe et je sais pas quoi faire ensuite, et comment donner l'accès à l'artisan et futur collaborateur de l'artisan qui pourront être sur l'application pour réaliser des prestations »*  
**Origine du diagnostic :** vidéo fournie par l'utilisateur (`SVID_20261106_001034_1.mp4`), analysée via l'outil d'analyse vidéo Manus.

---

## 1. Ce qui a été corrigé (problème « je clique et rien se passe »)

### Diagnostic confirmé

Dans l'onglet artisan **Demandes**, sur écran mobile (≤ 700 px), la grille `split-view` (deux colonnes sur ordinateur) se repliait **verticalement** : la liste des demandes au-dessus, le dossier sélectionné en dessous. Les clics sur les cartes ou les badges « À analyser » mettaient bien à jour le dossier dans l'application, mais ce dernier était affiché **tout en bas de la page, sous une très longue liste**, sans défilement automatique ni retour visuel. L'utilisateur voyait l'écran inchangé et pensait à un bogue.

### Correctif appliqué : master-detail responsive

1. **La liste se masque automatiquement sur mobile dès qu'un dossier est sélectionné** (`artisan-list-panel--hidden-mobile`).
2. **Le dossier s'affiche seul en pleine largeur**, avec un défilement automatique vers le haut de la page et une légère animation d'entrée pour que l'ouverture soit instantanément visible.
3. Un **bouton proéminent « Retour à la liste des demandes »** en haut de chaque dossier permet de revenir à la liste d'un seul geste (avec défilement de retour).
4. Chaque carte de dossier porte désormais un **indicateur orange « Ouvrir » avec chevron** et une **bordure gauche orange sur le dossier sélectionné**.
5. Le même comportement a été appliqué à l'onglet **Interventions**.
6. L'ouverture d'un dossier depuis les **notifications** ou le **planning** déclenche le même défilement.
7. Sur grand écran (ordinateur), le comportement deux colonnes d'origine est **totalement préservé**.

### Fichiers modifiés

- `client/src/components/mds/private-artisan-requests.tsx`
- `client/src/components/mds/simple-ux.css`
- `client/src/pages/Artisan.tsx`
- `server/mds/ui-version.test.ts` (tests de non-régression)

---

## 2. Réponse : comment donner l'accès à l'artisan ?

**L'accès artisan est déjà actif.** Aucune action n'est nécessaire.

| Élément | État vérifié en base de données |
|---|---|
| Compte artisan | `ife369243@gmail.com` (profil : **Ngoyone**, rôle : **admin**) |
| Activation | Déjà effectuée le 05/11/2026 à 18:36 |
| Comment y accéder | Aller sur `https://mdsservices-73dc9ex8.manus.space`, cliquer **Mon espace** (en haut à droite sur ordi, dernier onglet en bas sur mobile), se connecter avec `ife369243@gmail.com` |
| Où atterrit-il ? | Directement sur **/artisan** avec tous ses outils (Demandes, Planning, Interventions, Mes règlements, Activité) |
| Pourquoi rien à activer ? | Le code d'activation 64 caractères n'était nécessaire qu'une seule fois au premier démarrage ; cette étape est consommée. |

---

## 3. Réponse : comment donner l'accès aux futurs collaborateurs ?

### État réel aujourd'hui

L'application est construite autour d'**un seul artisan** : toutes les demandes lui parviennent et lui seul possède un accès privé. **Il n'existe pas encore de console de gestion d'équipe ni de rôle « collaborateur ».**

### Conception prête pour l'étape suivante

1. **Principe : un rôle opérationnel distinct**  
   - Les collaborateurs n'ont **pas** le rôle admin.
   - Ils ne voient **que les interventions qui leur sont assignées**.
   - Ils n'ont **pas** accès à l'onglet Activité (connexions, superviseurs), aux règlements/paiements, aux réglages MDS, ni aux demandes non assignées.
2. **Invitation par e-mail depuis l'espace artisan**  
   - Depuis un nouveau panneau **« Équipe »**, le propriétaire saisit l'e-mail du collaborateur.
   - Un lien/code d'invitation personnel est généré.
   - Le collaborateur se connecte avec son propre compte : l'association est automatique.
3. **Actions autorisées pour le collaborateur (terrain uniquement)**  
   - Démarrer le trajet (partage GPS réel pendant le trajet),
   - Confirmer l'arrivée (« Je suis arrivé », contrôle GPS < 500 m),
   - Commencer l'intervention,
   - Ajouter les photos obligatoires avant/après,
   - Terminer l'intervention (bloquée sans photo après travaux),
   - Faire signer le client sur l'écran en fin de chantier.
4. **Révocation d'un clic** par le propriétaire depuis le même panneau.

> **Recommandation immédiate :** ne jamais partager vos identifiants personnels. Chaque intervenant doit avoir son propre compte pour garantir la traçabilité juridique des actions (photos horodatées avec l'identité de l'auteur, signature client, validation).

Cette extension (base de données + panneau d'invitation + restrictions d'accès par rôle) peut être développée en prochaine étape sur votre demande.

---

## 4. Vérifications effectuées

| Vérification | Résultat |
|---|---|
| `pnpm check` (TypeScript) | **0 erreur** |
| `pnpm test` (tests automatisés) | **273/273 passants** (13 fichiers, dont 10 tests UI anti-régression) |
| `pnpm build` (production) | **OK** |
| `/api/health` | **HTTP 200** |
| Les 10 routes déclarées (`manus-routes.json`) | **Toutes HTTP 200** |
| Compte artisan en base | id=1, Ngoyone, admin, activation consommée |
| Site publié | `https://mdsservices-73dc9ex8.manus.space` |

---

## 5. Ce qui reste en réserve pour la suite

1. Développer le module **« Équipe / Collaborateurs »** décrit en section 3 (sur demande explicite).
2. Vérifier une fois le rendu mobile directement sur votre téléphone depuis l'URL publiée : ouvrir **Demandes**, toucher un dossier, confirmer qu'il s'affiche en grand avec le bouton de retour.
3. Conserver la base telle quelle : la base est partagée entre test et production, **ne jamais supprimer de données sans identification explicite**.
