# MULTISERVICES MDS — Livraison : cartes de formules 100 % cliquables et souscription professionnelle express en 1 minute

**Date :** 6 novembre 2026  
**Demande initiale :**  
> *« quand je clique rien se passe, comment un professionnel peut souscrire à une offre rapidement au lieu de lire plein de texte, quand je clique sur une offre rien se passe également, et c'est pareil partout et pour tout. normalement tout doit être rapide à exécuter et finaliser. »*

**Origine du diagnostic :** analyse vidéo de `SVID_20261106_004658_1.mp4` avec l'outil d'analyse vidéo Manus — confirmation que l'utilisateur tapait sur « Formule Mensuelle » (00:47–00:50) et « Formule Annuelle » (00:51–00:52) sans aucune réaction visuelle, car ces cartes étaient de simples éléments de mise en page non interactifs.

---

## 1. Ce qui a été corrigé

| Problème | Correction |
|---|---|
| Cartes de formules inertes | Chaque formule devient un **vrai bouton cliquable** : survol animé, état sélectionné orange avec badge « Sélectionnée ✓ », bouton interne « Choisir cette formule → » |
| Aucun effet au clic | Un clic **pré-sélectionne la formule** dans le formulaire et **défile automatiquement** jusqu'à lui |
| Souscription trop longue | Formulaire express en **4 champs obligatoires seulement** (Nom, Organisation, Téléphone, E-mail) — rempli en moins d'une minute |
| Secteurs ciblés non exploitables | Les 7 cartes secteurs sont désormais **cliquables** : un clic pré-sélectionne le profil d'organisation et défile vers le formulaire |
| Formule figée dans le formulaire | Sélecteur en **gros boutons (pills)** : Annuelle · tarif réduit / Mensuelle / Sur-mesure, commutable en un tap |
| Détails facultatifs | Bâtiments/lots, adresse du site et message sont repliés dans un bloc « Préciser mon parc ou mes besoins (facultatif) » — ils ne bloquent plus l'envoi rapide |

---

## 2. Le parcours d'un professionnel en 3 étapes (≈ 1 minute)

1. **Il arrive sur `/professionnels`** et voit directement les secteurs et les 3 formules (Mensuelle, Annuelle à tarif réduit, Sur-mesure).
2. **Il clique sur la formule** qui lui convient (ou sur « Choisir cette formule → ») : la carte passe en orange « Sélectionnée ✓ » et la page défile vers le formulaire, avec sa formule déjà cochée.
3. **Il saisit ses 4 coordonnées** et clique « Envoyer ma demande de souscription (gratuit) » : confirmation immédiate avec numéro de dossier, réponse chiffrée sous 24–48 h, et la demande apparaît chez l'artisan comme dossier prioritaire avec badge « Action requise ».

> En cas d'urgence, le numéro **06 04 15 99 16** reste cliquable à chaque étape pour un contact direct.

---

## 3. Moins de texte, plus d'action

- Les longs paragraphes ont été remplacés par des **puces courtes et lisibles**
- La section « Pour qui travaillons-nous ? » invite explicitement : *« Cliquez sur votre profil pour pré-remplir votre demande »*
- La section formules invite : *« Cliquez une formule pour passer directement à la souscription »*
- Tout est **actionnable** : chaque carte mène quelque part, aucun clic n'est désormais « dans le vide »

---

## 4. Vérifications

| Contrôle | Résultat |
|---|---|
| TypeScript (`pnpm check`) | **0 erreur** |
| Tests automatisés (`pnpm test`) | **295/295 passants** sur 13 fichiers |
| Compilation production (`pnpm build`) | **OK** |
| Santé serveur | **HTTP 200** |
| Les 10 routes | **Toutes HTTP 200** |
| Fichier clé | `client/src/pages/Professional.tsx` (clic formule + secteur + souscription express) |

---

## 5. Fichiers modifiés

- `client/src/pages/Professional.tsx` — cartes interactives, pré-sélection, formulaire express
- `client/src/components/mds/simple-ux.css` — états cliquables/sélectionnés, pills de formule, détails repliables
- `server/mds/ui-version.test.ts` — 6 nouvelles assertions de non-régression
- `docs/CONTINUITE.md` — journal mis à jour
