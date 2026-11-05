# MULTISERVICES MDS — Livraison : refonte UX/UI Uber (accueil Uber Eats, suivi Uber, identité officielle, photos réelles)

**Date :** 6 novembre 2026  
**Demande initiale :**  
> *« un design en 4k fluide rapide et moderne sans artefact ia, une rapidité d'exécution »*  
> (avec le logo officiel MDS et la maquette 8 écrans mobile en référence visuelle, plus le cahier des charges complet de la refonte Uber collé dans `pasted_content.txt`.)

---

## 1. Identité de marque officielle (adieu le faux logo « fait trop IA »)

| Élément | Avant | Après |
|---|---|---|
| **Logo de la marque** | Faux logo SVG approximatif (871 o) | **Vrai logo officiel MDS** fourni par le propriétaire, intégré en PNG haute résolution (1254×1254) + versions optimisées 320 px et 180 px (PNG + WebP) |
| **Écrans 4K / Retina** | Logo flou sur mobile | `srcSet` 180w / 320w / 1254w avec tailles adaptées — netteté parfaite sur tout écran |
| **Favicon** | Ancien SVG | Favicon PNG net issu du logo officiel |
| **PWA (application mobile)** | Icône SVG | Icônes 180×180, 320×320 et 1254×1254 dans le manifest web |

---

## 2. Accueil façon **Uber Eats** (`client/src/pages/Home.tsx`)

Inspiré de l'écran 2 de la maquette :

- **Héro avec photo réelle d'artisan** (`hero-artisan.webp`, 1387×1134 + version 700 px) — aucune image générée par IA ne reste sur l'accueil
- **Bannière orange MDS** : « Un seul interlocuteur. Tous vos travaux. » + bouton principal « Demander un devis gratuit »
- **Fiches confiance** (inspirées du splash screen Uber de la maquette) : *Fiable · Rapide · À proximité · 1 seul artisan*
- **Barre de localisation** : « Zone d'intervention : Rennes et son agglomération — jusqu'à 30 km »
- **Barre de recherche de service** avec filtrage instantané des métiers et des types de problèmes (ex. tapez « fuite », « peinture », « disjoncteur »)
- **« Catégories populaires »** (5 corps de métier avec icônes + « Autre problème »)
- **Engagements**, numéro d'appel d'urgence **06 04 15 99 16**
- **Séparation stricte Particulier / Professionnel** par deux cartes d'accès visuellement distinctes

---

## 3. Séparation stricte des trois espaces

| Espace | Public cible | Contenu | Contrôle |
|---|---|---|---|
| **Particulier** | Particuliers à domicile | Accueil, demande guidée, suivi live | Accès libre, aucun compte obligatoire |
| **Professionnel** | Mairies, HLM, syndics, hôpitaux, écoles, centres commerciaux, entreprises | Offre pro publique + espace organisation connecté | Connexion requise seulement pour les organisations |
| **Artisan** | Propriétaire MDS (+ futurs collaborateurs) | Atelier : demandes, planning, interventions, règlements, activité | **Réservé administrateur** (redirection propre) |

Aucun lien croisé trompeur : les passerelles sont étiquetées (« Vous êtes l'artisan MDS ? », « Accéder à l'espace professionnel »).

---

## 4. Demande d'intervention enrichie (`client/src/pages/Request.tsx`)

- **Option de récurrence** à l'étape 4 : *Intervention ponctuelle* vs *Abonnement (mensuel / annuel)* avec passerelle vers l'offre pro (comme sur l'écran 6 de la maquette)
- La mention de récurrence est incluse dans la description envoyée à l'artisan
- Stepper 4 étapes aligné sur la maquette : **1 Service · 2 Détails · 3 Disponibilité · 4 Validation**
- Téléversement de **photos multiples** dès l'étape 2 avec prévisualisations
- Contrôle de créneau : les prestations tarifées imposent un créneau, les demandes libres passent sans créneau (corrigé au backend)

---

## 5. Suivi live façon **Uber** (`client/src/pages/Tracking.tsx`)

Inspiré des écrans 7 et 8 de la maquette :

- **Carte interactive sombre** (Mapbox), position réelle de l'artisan, itinéraire orange, distance restante et ETA calculée — jamais de fausse position
- **Carte d'identité de l'artisan** avec sa **vraie photo** (`artisan-avatar.webp`), spécialités, note **4,8 ★** et bouton d'appel direct
- Barre de progression 4 étapes : Demande reçue → Confirmée → En intervention → Terminée
- **Fin d'intervention** : photos avant/après obligatoires avec vignettes déchiffrées, signature tactile du client sur l'écran, checklist de validation, bouton de contact support

---

## 6. Navigation mobile (`Layout.tsx`)

Alignée sur la maquette : **Accueil · Mes demandes · Contrats (vers `/professionnels`) · Mon espace / Artisan**. Le footer légal reste accessible sur la page pro.

---

## 7. Performance et qualité (4K, fluide, sans artefact IA)

- Toutes les images converties en **WebP avec version mobile** (poids héro : 296 ko desktop / 107 ko mobile ; avatar : 13 ko ; logo : 15 ko)
- `srcSet` et `loading` adaptés sur les images critiques
- Typographie système Inter + Manrope préchargée (déjà en place)
- Aucune bibliothèque lourde ajoutée
- **0 artefact IA** : les images d'illustration de la page d'accueil et des problèmes sont toutes des **photos réelles** (photos fournies par le propriétaire pour le héros et l'avatar, photos réelles de métier pour les 26 types de problème)

---

## 8. Vérifications

| Contrôle | Résultat |
|---|---|
| `pnpm check` (TypeScript) | **0 erreur** |
| `pnpm test` (tests automatisés) | **289/289 passants** sur 13 fichiers (dont 24 assertions UI/logo/héro/recherche/récurrence/carte artisan) |
| `pnpm build` (production) | **OK** |
| Santé du serveur | **HTTP 200** sur `/api/health` |
| Les 10 routes déclarées | **Toutes HTTP 200** |
| Assets statiques | `mds-logo-320.png`, `hero-artisan.webp`, `artisan-avatar.webp`, `favicon.png` tous **HTTP 200** |
| Site publié | `https://mdsservices-73dc9ex8.manus.space` |

---

## 9. Fichiers modifiés ou créés

- `client/src/pages/Home.tsx` — refonte Uber Eats (héro photo réelle, recherche, fiches confiance, adresse, catégories)
- `client/src/pages/Request.tsx` — récurrence ponctuelle/abonnement
- `client/src/pages/Tracking.tsx` — carte d'identité artisan avec vraie photo
- `client/src/components/mds/Layout.tsx` — logo officiel srcset, nav mobile avec Contrats, footer pro
- `client/src/components/mds/simple-ux.css` — styles recherche, fiches confiance, adresse, récurrence, carte artisan
- `client/index.html` — favicon PNG officiel
- `client/public/manifest.webmanifest` — icônes PWA officielles
- `client/public/mds-logo*`, `hero-artisan*`, `artisan-avatar.webp`, `favicon.png` — nouveaux assets officiels
- `server/mds/ui-version.test.ts` — 24 assertions de non-régression UI
- `docs/CONTINUITE.md` — journal mis à jour
