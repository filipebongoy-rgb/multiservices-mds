# Rapport de livraison — Nettoyage du planning et séparation stricte des rôles

**Date** : 2026-11-06. **Demande utilisateur** : « l'artisan doit avoir la possibilité de supprimer des rdv déjà effectué ou refuser et j'ai l'impression que tout est mélangé, un utilisateur peuvent avoir accès à tout et avoir les mêmes menus ».

## 1. Ce qui a été identifié

Le planning conservait indéfiniment chaque rendez-vous, y compris les interventions terminées, sans aucun bouton de nettoyage. Aucune procédure backend ne permettait de supprimer un rendez-vous (seulement `appointments.list` et `calendar.get` existaient).

En parallèle, les menus promeuvaient l'espace artisan aux simples visiteurs : le menu déroulant « Espaces » du header contenait pour tous un lien direct vers « Espace artisan », la page d'accueil affichait une carte « Vous êtes l'artisan ? » au même rang que les espaces clients, et la navigation mobile mélangeait les rôles. L'espace de gestion interne donnait ainsi l'impression d'être un menu public ouvert à tous, et les visiteurs pouvaient tenter de s'y connecter, alors que les données restaient bien protégées côté serveur.

## 2. Ce qui a été livré

### 2.1 Planning artisan nettoyable

Deux nouvelles mutations backend ont été ajoutées dans le module calendrier : `deleteAppointment`, qui supprime un rendez-vous par son identifiant avec vérification du rôle artisan et journalisation de l'audit, et `cleanCompletedAppointments`, qui supprime en masse l'ensemble des rendez-vous terminés. Dans l'interface du planning, les rendez-vous sont désormais filtrés par statut avec « À venir » affiché par défaut, « Tous » et « Terminés ». Chaque rendez-vous dispose d'un bouton rouge de suppression avec confirmation (« Supprimer ce rendez-vous du planning ? »), et un bouton « Nettoyer les rendez-vous terminés » apparaît dès qu'au moins une intervention est achevée. L'historique des interventions et les événements restent conservés : seul l'affichage du planning est purgé.

### 2.2 Menus strictement séparés par rôle

Le menu déroulant du header s'adapte désormais au rôle de la session. Pour un visiteur ou un client non-admin, il ne propose que « Demander un devis (particulier) », « Espace professionnel », « Catalogue des prestations », « Suivi de mes demandes » et « Mon profil » lorsqu'il est connecté, sans aucun lien vers l'espace artisan. Pour l'artisan administrateur uniquement, il affiche « Atelier artisan », « Voir le site public », « Espace professionnel », « Catalogue prestations » et « Mon profil ». Le libellé du bouton lui-même devient « Menu » en étant déconnecté, « Mon compte » en étant connecté en tant que client, et « Artisan » pour le propriétaire.

La navigation mobile du bas applique la même logique avec quatre entrées grand public pour les clients (Accueil, Réserver, Suivi, Compte) et quatre outils dédiés pour l'artisan (Atelier, Site public, Demandes, Profil). La carte artisan a été retirée du contenu principal de la page d'accueil ; le propriétaire conserve son accès par le lien discret « Accès artisan » du footer. Enfin, l'écran de verrouillage de `/artisan` a été reformulé « Accès réservé — Atelier de l'artisan », explicitement réservé au propriétaire de MULTISERVICES MDS, avec des passerelles directes vers les espaces particuliers et professionnels, et son formulaire d'activation par code a été replié dans un panneau pour ne plus perturber les visiteurs.

## 3. Ce qui était déjà en place

Les données réelles ont toujours été protégées côté serveur : seuls les comptes administrateurs accèdent aux dossiers de l'artisan (`artisan.ts`, `requests.ts`, etc.). Le refus de demande existe déjà depuis chaque dossier dans l'onglet Demandes (« Refuser »). La redirection OAuth envoie enfin les comptes clients vers le site public et seul le compte administrateur vers l'atelier artisan.

## 4. Vérifications

Tous les 302 tests passent sur 13 fichiers, incluant les assertions de non-exposition de l'artisan dans les menus publics, l'adaptation de la navigation mobile par rôle et le nettoyage du planning. La vérification TypeScript `pnpm check` est sans erreur, la compilation de production `pnpm build` réussit avec le nouveau chunk de l'icône poubelle, et les dix routes déclarées renvoient HTTP 200 sur le serveur de développement avec un `/api/health` opérationnel.

## 5. Fichiers modifiés

- `server/mds/calendar.ts` : `deleteAppointment`, `cleanCompletedAppointments`
- `server/mds/calendar.test.ts` : tests des deux mutations (protection rôle et audit)
- `client/src/components/mds/private-calendar.tsx` : filtres de statut, boutons de suppression et de nettoyage
- `client/src/components/mds/Layout.tsx` : menu déroulant et navigation mobile séparés par rôle
- `client/src/pages/Artisan.tsx` : écran de verrouillage explicite et activation repliée
- `client/src/pages/Home.tsx` : suppression de la carte artisan publique
- `server/mds/ui-version.test.ts` : assertions de non-régression
- `docs/CONTINUITE.md` : journal de livraison
