# Continuité MULTISERVICES MDS

Ce projet est l’unique application de la série de trois prompts. Ne pas créer une seconde application. Identifiant du projet : `wdp_99aa391c81e3df9b53d6f75a` ; ressource : `manus-resource://manus-webdev/project/wdp_99aa391c81e3df9b53d6f75a`. Dossier actuel : `/home/ubuntu/mdsservices`.

Le brief initial a été suivi de `docs/double-validation-brief.txt`, qui rend centrale la double validation MDS puis client. `shared/mds.ts` est la source des familles, des schémas de saisie, des statuts et des formats. `drizzle/schema.ts` et les migrations sont la source du modèle relationnel. `plan.md` et `TODO.md` décrivent les décisions et les résultats. `docs/api-contract.md` coordonne les API et les interfaces ; les types tRPC du code font foi pour les ajouts finaux.

## Règles à préserver

Un seul artisan, aucune marketplace. Catalogue initial inactif, aucune disponibilité, entreprise ou facture fictive. La demande client ne réserve pas un créneau. Une proposition artisan doit préciser le prix et le créneau ; un devis complexe exige une acceptation distincte. Le rendez-vous est créé uniquement après la confirmation client requise et la vérification du conflit de planning. Les actions sont transactionnelles, horodatées et soumises à un contrôle de version. Les nouvelles fonctionnalités doivent passer par ces règles et non contourner le moteur actuel.

Chaque organisation accède uniquement à ses données avec vérification côté serveur. Les photos et documents sont chiffrés avant stockage objet et restitués via une API autorisée, jamais par une URL publique de contenu en clair. Ne pas utiliser les sessions de test comme authentification de production, ne pas donner le rôle artisan au premier visiteur et ne pas publier les évaluations automatiquement.

## Exploitation

La base MySQL gérée est commune à la Preview et à la future production. `pnpm db:migrate` applique les migrations versionnées ; le seed de configuration ne doit pas écraser les modifications administrateur. Le serveur se lance avec `pnpm dev` sur le port déclaré 3000 ; `pnpm build` produit le frontend et le serveur du Dockerfile. Le build prépare aussi le contenu HTML initial des pages publiques. `pnpm check` et `pnpm test` assurent les contrôles automatiques ; ils ne remplacent pas une recette métier avec les vrais comptes de MDS.

L’artisan doit se connecter puis activer son rôle avec le code privé remis séparément. Ce code n’est pas dans Git et ne doit jamais être ajouté au projet. Après activation, configurer identité légale, coordonnées, zone, règles et prestations réellement proposées.

## Poursuite au prompt 2/3

Ajouter le calendrier avancé et l’administration des disponibilités/blocages, sans permettre de rendez-vous définitif avant double validation. Ajouter les canaux e-mail/SMS après sélection et configuration d’un fournisseur ; les notifications actuelles sont internes. Prévoir une tâche d’expiration application-native authentifiée, idempotente et durable : la version actuelle vérifie les expirations lors des consultations et actions, mais n’exécute pas seule une tâche en l’absence de trafic. Éviter de confondre cette vérification à l’accès avec un planificateur autonome.

Les devis et factures actuels sont des documents réels déposés par l’artisan, pas un générateur comptable. Le paiement est déclaré et documenté par l’artisan après une vérification extérieure réelle ; il n’est pas encaissé par l’application. Le registre contractuel est une fondation à compléter pour renouvellements et échéances. Prévoir une politique de conservation et la suppression physique des objets, les règles de modération, une recette OAuth avec les comptes réels et un audit WCAG 2.2 AA avant ouverture commerciale.

## Extension hybride définitive du prompt 1 — 5 novembre 2026

`docs/brief-hybride-prompt1.txt` est le brief de poursuite, avec modes prix affiché et devis personnalisé. `shared/pricing.ts` porte le calcul en centimes et les frais de déplacement ; `server/mds/tariffs.ts` calcule le résultat serveur, son empreinte et les gardes tarifaires. Le client doit relire les conditions après changement de configuration. Les nouveaux dossiers gardent un instantané immuable ; ne pas recalculer rétroactivement leurs prix avec le catalogue courant. Les anciens dossiers sans instantané gardent leur parcours identifié comme historique.

L’intégration Stripe a été provisionnée en test. La page `/paiements` et le suivi distinguent essais, règlements en ligne commerciaux et paiements vérifiés manuellement. Un essai Stripe réussi ne règle jamais la facture réelle. Le webhook signé est enregistré avant le parseur JSON Express. Les montants de facture proviennent de l’accord contractuel du dossier ; aucun montant de navigateur ou paramètre de retour ne doit être considéré comme paiement. Ne pas ouvrir l’encaissement commercial sans compte MDS et clés commerciales configurés par le propriétaire.

Préserver les migrations additives, l’absence de faux clients, les contrôles de révocation d’organisation et la confirmation client distincte du devis. Une référence de facture seule ne remplace pas une permission ou le lien privé d’un particulier. Les paiements doivent toujours être reconciliés avec leur montant/devise/mode exacts et des identifiants d’événement persistants.

## PROMPT 2/3 — moteur opérationnel et priorité UX

`docs/brief-prompt2.txt` et `docs/brief-refonte-ux.txt` sont les références de cette suite. La navigation initiale est remplacée par trois entrées principales par espace : artisan Demandes/Planning/Interventions, professionnel Déclarer/Suivre/Bâtiments, public Demander/Suivre/Espaces. L’accueil est désormais sans photographie décorative ni tutoriel : phrase courte, description, cinq métiers et demande libre. Le formulaire regroupe Besoin → Adresse et créneau → Envoyer ; l’adresse et le contact d’un bâtiment connu sont repris. Les consentements de prix/devis/acompte/supplément ne sont jamais supprimés au prétexte de trois clics.

`shared/operations.ts` et la migration 0004 étendent la même base. `server/mds/calendar.ts` porte horaires Paris/DST, périodes disponibles/bloquées, zones et déplacement/sécurité. `checkCalendar(tx,times,request)` s’utilise sous le verrou de paramètres et son résultat est figé dans le rendez-vous confirmé. Aucun créneau choisi, IA, devis ou modalité d’acompte ne remplace la double validation de réservation.

`requests.ts` conserve la machine et ajoute alternatives UUID serveur, départ réel, photo/précisions/diagnostic. `operations.ts` porte les incidents/réclamations et les suppléments avec accord préalable, début/fin déclarés et contrôle du montant à facturer. `quote-builder.ts` et `quote-pdf.ts` produisent des brouillons structurés et PDF privés chiffrés ; un brouillon n’est pas transmis aux clients. Une émission exige le montant réel du PDF et sa validité. Un document généré est immuable et une révision passe par copie/version.

`payments.ts`, `payment-stages.ts`, `refunds.ts` et le webhook distinguent intégral/acompte/solde et remboursements relus auprès de Stripe. `commercialPaidCents(tx,requestId)` exclut tout test, réserve non prouvée ou fond à rapprocher. Le paiement manuel porte seulement le solde exact restant et ne concurrence pas une session live encore réutilisable. Un remboursement commercial confirmé peut réouvrir financièrement une facture sans inventer une nouvelle intervention. Le prestataire actuellement configuré reste en test.

`qualification.ts` utilise un modèle disponible, un format structuré, consentement, délai maximal et repli manuel. Les coordonnées structurées ne sont pas transmises ; la description peut toutefois contenir des données écrites par l’utilisateur, ce qui est expliqué dans la confidentialité. `automation.ts` et `outbox.ts` assurent callback JWT/projet/taskUid, registre d’exécution, expirations, rappels, file et relecture de livraison. Les canaux Resend/Twilio sont préparés, pas activés. Le registre ne confond jamais fournisseur ayant accepté avec livraison prouvée. `scripts/bind-maintenance.ts` est une commande opérateur finie après publication, jamais un script de démarrage.

Les tests métier n’injectent aucun dossier de démonstration dans MySQL. Avant ouverture, suivre `docs/ACTIVATION_PROMPT2.md` : identité et droit artisan réels, prestations réellement validées, calendrier/mentions légales, fournisseurs autorisés, publication explicitement autorisée et première exécution native vérifiée. L’automatisation autonome reste non activée dans la Preview ; le traitement manuel confirmé est disponible pour reprise.

## Préparer le PROMPT 3/3

Continuer ce même dépôt pour gestion professionnelle avancée, contrats, administration et audit final selon le nouveau brief à recevoir. Préserver les trois rubriques principales ; exposer les fonctions avancées par contexte plutôt que recréer une multitude de menus. Restent à approfondir les cycles contractuels/renouvellements/échéances, la politique de conservation et suppression physique, la modération des avis, la recette avec les comptes/dossiers réels et l’audit juridique/accessibilité avant ouverture. Ne pas activer automatiquement l’encaissement commercial, un fournisseur ou un planificateur sans le choix/les paramètres et la publication nécessaires.

## PROMPT 3/3 — première tranche intégrée

Les revues de cadrage du prompt 3 ont été faites en niveau lite uniquement. La demande réutilise désormais une fiche client existante par identité authentifiée ou par correspondance exacte e-mail+téléphone au sein d’une organisation ; elle ne fusionne pas sur le seul nom. `server/mds/clients.ts` expose au seul artisan la recherche et le détail avec l’historique de demandes, et `private-clients.tsx` l’affiche dans les paramètres contextuels sans nouveau menu principal.

`organizations.updateContract` permet au propriétaire/gestionnaire d’une organisation de modifier nom, statut et bornes de dates avec appartenance serveur, verrou, validation et audit. L’espace professionnel conserve Déclarer/Suivre/Bâtiments ; les contrats restent dans Bâtiments mais sont maintenant administrables. Le PDF lié n’est pas remplacé ni rendu public.

Bilan détaillé : `docs/COMPTE_RENDU_PROMPT3.md`. Les priorités suivantes sont contrats structurés avec échéances/renouvellement, gouvernance RGPD conservation/export/effacement, audit enrichi/paginé, modération des avis, invitations révocables et audit final avec intégrations réelles. Ne pas activer e-mail/SMS, Stripe live, publication ou tâche native autonome sans configuration et autorisation explicites.

## PROMPT 7 — preuve photographique obligatoire

Une intervention MDS, particulière ou professionnelle, ne peut jamais passer à `completed` sans au moins un document privé `kind=photo` avec `photoStage=after`. Cette condition est contrôlée dans la transaction serveur de `requests.artisanAction({ action: "complete" })` ; un commentaire, une déclaration écrite ou une justification d’absence ne peut pas la remplacer. Le document doit être téléversé, chiffré et indexé avant l’action de fin ; son auteur (`photoAuthor`), sa date et son heure sont conservés dans l’index et l’audit. Les preuves ne doivent pas être supprimées silencieusement.

Tant que cette preuve n’existe pas, le dossier n’est pas terminé, la confirmation client n’est pas disponible et aucun futur transfert artisan ne peut être autorisé. Après dépôt, une notification est créée ; le client doit confirmer explicitement ou ouvrir une réclamation. Le dépôt d’une photo seul ne libère jamais automatiquement les fonds. Les paiements réels restent désactivés tant que le montage Stripe Connect, la conformité française, le compte MDS et les conditions de transfert différé ne sont pas validés par le propriétaire.

L’espace artisan contient désormais `Mes règlements`. Sa lecture serveur rapproche les paiements réussis avec le dossier, l’intervention et les incidents ouverts, puis affiche : `En attente de validation client`, `En attente de transfert`, `Transféré` ou `Bloqué pour réclamation`. L’état `Transféré` n’est pas produit tant qu’aucun mécanisme de transfert réel et vérifié n’est activé ; l’interface indique explicitement que la Preview et les paiements de test ne constituent pas un virement ni un séquestre.

## Réservation sur disponibilités artisan

Le planning public utilise le même moteur que le planning privé MDS. L’artisan active le calendrier, définit ses plages hebdomadaires, ses ouvertures exceptionnelles, ses blocages, ses zones de déplacement, ses marges et son horizon. Le client choisit une date puis un créneau calculé selon la durée réelle de la prestation ; les créneaux en conflit, hors zone, passés, bloqués ou incompatibles avec le déplacement sont exclus.

Lorsque le calendrier public est activé, le serveur exige un créneau choisi pour une prestation cataloguée et réexécute `checkCalendar` au dépôt de la demande. La confirmation finale réexécute également ce contrôle sous verrou, car l’affichage d’un créneau ne constitue pas à lui seul une réservation définitive. Une demande libre reste orientée vers MDS pour évaluation de durée et proposition de créneau.

## PROMPT 9 — suivi GPS inspiré d’Uber

Le suivi GPS réel est cadré sur Mapbox avec une PWA mobile pour l’espace artisan. La carte client doit rester inactive avant le départ réel et ne pourra jamais afficher une position simulée. La PWA installable est préparée par `client/public/manifest.webmanifest`, avec un accès direct à l’espace artisan. Le token public Mapbox est maintenant configuré côté navigateur ; il devra être restreint aux domaines MDS dans le tableau de bord Mapbox avant publication commerciale.

Le trajet suit désormais `Démarrer le trajet` → position réellement autorisée et envoyée → `Je suis arrivé` → `Commencer l’intervention`. L’arrivée est horodatée côté serveur, arrête le partage GPS et envoie une notification automatique intitulée `Artisan arrivé`. Le message de départ peut être personnalisé dans le modal artisan ; l’événement de départ déclenche aussi la notification automatique `Artisan en route`. Le client dispose d’un bouton `Appeler MDS` avec l’action téléphonique native du téléphone. Les points GPS restent limités au dossier courant, protégés côté serveur et horodatés ; aucune position ou ETA n’est fabriquée en cas de refus ou perte réseau. La notification d’approche avant arrivée, la conservation limitée des anciens points et le suivi en arrière-plan restent à compléter dans la tranche suivante.

## Alignement sur la maquette MDS (8 écrans) — 5 novembre 2026

- Demande : sélection du problème illustrée (cercle, libellé, précision, photo à droite), écran « Détails de votre demande » (rappel du service, description sur 500 caractères, adresse d’intervention, ligne « Ajouter des photos »), écran « Vos disponibilités » (onglets Aujourd’hui, Demain, jours suivants, et créneaux réels « HH:MM – HH:MM »).
- Le bouton « Continuer » n’est plus grisé sans explication : il affiche le message de ce qui manque.
- Suivi client : carte « Preuves de fin d’intervention » avec miniatures avant/après réellement déchiffrées par le serveur (contrôle des droits et journalisation), encart « Paiement sécurisé » et frise Paiement → Validation → Règlement. Le règlement à l’artisan n’est jamais affiché comme effectué sans donnée réelle.
- Correctif : « Appeler MDS » composait le numéro du client lui-même ; il compose désormais le numéro public de MDS (paramètres), et il est masqué si aucun numéro n’est configuré.
- En-tête : cloche des notifications réelles du compte (non lues, marquage comme lu) et icône téléphone qui appelle réellement MDS (elle ouvrait auparavant le formulaire).
- Barre du bas : dernier onglet renommé « Mon espace ».
- Dossier artisan : frise Arrivé → Travaux → Photos → Validation, compteurs de photos avant/après (photo après obligatoire), boutons de trajet bleu nuit, bleu et vert comme sur la maquette.

## Supervision admin, signature tactile du client et alignement Uber Eats — 5 novembre 2026 (fin de journée)

- Accueil corrigé : le titre « Un problème chez vous ? » est désormais blanc et lisible sur gradient sombre doux ; la bannière entreprise (« Vous êtes une entreprise ou une collectivité ? ») et le footer sombre ont été restaurés pour compléter la fidélité à la maquette.
- Administration opérationnelle : nouvel onglet « Activité » dans l’espace artisan avec KPI (demandes, clients uniques, chiffre d’affaires encaissé), dernières connexions tracées (audit `user.login`), dernières demandes complètes, et paiements avec **motif exact de chaque échec Stripe** stocké sur l’entité paiement.
- Alertes artisan : les nouvelles demandes déclenchent une notification push propriétaire instantanée, remontent en tête de liste avec l’étiquette « Action requise », et un bandeau d’alerte reste affiché tant qu’une réponse attend.
- Zone d’intervention : l’artisan est basé à Rennes (35000), la zone configurée couvre l’agglomération et jusqu’à 30 km aux alentours.
- Signature tactile du client : pad sur canvas HTML5 avec `touchAction: "none"`, utilisable sur téléphone par le client dans son suivi et par l’artisan avec le bouton « Faire signer le client sur cet écran » ouvrant un modal dédié. La signature est chiffrée, horodatée, et conservée comme preuve ; elle vaut validation des travaux et conditionne le règlement de l’artisan.
- Documents livrés : `docs/GUIDE-ARTISAN.md` (guide d’utilisation répondant aux questions concrètes de l’artisan), `docs/ANALYSE-UBER-EATS.md` (analyse sourcée du système Uber Eats) et `docs/AUDIT-EXPERIENCE-CLIENT.md` (audit comparatif écran par écran).

## Correction des illustrations de problèmes et du proxy de stockage — 5 novembre 2026

- **Images de problèmes** : les 37 vignettes IA précédemment générées étaient des placeholders d’échec SVG (« Image generation failed ») à cause de défaillances silencieuses du générateur d’images. Elles ont été intégralement remplacées par de **vraies photos d’illustration** (26 photos libres de droits uniques, optimisées en WebP à 280×190 dans `client/public/problems/`) couvrant tous les problèmes du catalogue (fuite, robinetterie, WC, lavabo, débouchage, chauffe-eau, raccordements, panne électrique, prises, interrupteurs, éclairage, tableau, VMC, radiateurs, chaudière, thermostat, murs, plafonds, portes, rebouchage, ponçage, rénovation, montage de meubles, fixations). Vérification automatique : 26/26 renvoient HTTP 200.
- **Proxy de stockage** : `registerStorageProxy(app)` n’était pas monté dans `server/_core/index.ts`, ce qui renvoyait du HTML SPA (404) sur toute URL `/manus-storage/*`. Monté et testé : la vraie photo hero (1920×1080) se télécharge désormais avec HTTP 307→200 image/webp.

## PROMPT 7/8/9 finalisés — 5 novembre 2026 (soirée)

- Preuve photo après travaux obligatoire : contrôle serveur strict dans `server/mds/requests.ts`, finalisation rejetée sans photo (message explicite), intervention clôturée avec statut `completed` dès qu'une preuve est enregistrée.
- Validation client explicite avec horodatage `clientConfirmedAt`, règlements artisan calculés honnêtement sans virement simulé (4 états), espace profil complet `/profil`.
- Suivi inspiré d'Uber Eats : carte de statut vivant, prochaine action, bandeau accueil « Intervention en cours », cloche de notifications réelle, onglet « Mon espace », documents `docs/ANALYSE-UBER-EATS.md`, `docs/GUIDE-ARTISAN.md`, `docs/AUDIT-EXPERIENCE-CLIENT.md`.
- Suivi GPS Mapbox réel (token corrigé), notification d'approche automatique, 3 actions artisan, arrêt GPS à l'arrivée, appel MDS direct.
- Compléments : vraies photos locales des problèmes (30+), tarifs officiels MDS seedés avec prix gelés au dépôt, onglet artisan Activité/Admin (connexions, demandeurs, échecs Stripe avec motifs), alertes propriétaire sur chaque événement, signature tactile du client chiffrée, accueil professionnel.
- Cycle complet d'intervention vérifié de bout en bout en base avec vraies données.

## Vérification globale

- 265 tests automatisés passants (13 suites), TypeScript strict sans erreur, build production OK.

## Correctif accès artisan et dédoublonnage du pied de page — 5 novembre 2026 (fin de passe)

- Dédoublonnage du pied de page : suppression du footer redondant de `Home.tsx`, enrichissement du `Footer` global de `Layout.tsx` (signature MDS, numéro officiel, accès artisan) appliqué à toutes les pages de façon unique.
- Accès artisan rendu visible : lien direct sur la page d'accueil, dans le menu des espaces, dans la navigation desktop (pour l'admin) et dans la barre mobile (onglet « Artisan » pour l'artisan) ; panneau « Espace artisan » au sommet de `/profil` avec raccourcis demandes, et aide à la connexion pour les utilisateurs déconnectés.
- 268 tests automatisés passants (3 tests de non-régression ajoutés).

## Passe de simplification — 5 novembre 2026

- **Parcours de demande** : titres d’étapes courts et percutants (« Votre logement », « Votre problème », « Détails », « Votre disponibilité », « Vérification ») ; indices d’aide au choix sur chaque problème de chaque métier ; choix du type de bien transformé en grandes cartes visuelles avec description.
- **Suivi client** : écran vide épuré, centré sur une seule action principale (saisie de référence) avec raccourci de connexion et accès aux demandes enregistrées.
- **Catalogue & accueil** : sous-titres descriptifs sous chaque métier de l’accueil (« Fuites, robinetterie… ») et placeholder de recherche simplifié.
- Suite de tests : 268 passants, build production OK.

## Simplification de l’espace artisan (page réservée) — 5 novembre 2026 (fin de passe)

- **Header compact** : titre dynamique de l’onglet actif (ex. « Demandes ») avec chip « X à traiter », suppression du grand titre doublon « Votre atelier ».
- **Onglets pilules discrets** : navigation principale masquée sur mobile au profit d’une barre fixe en bas de l’écran.
- **Retrait des doublons visuels** : bannière d’alerte orange redondante, panneau « Comment répondre en 3 clics », résumé TodaySummary et phrase d’exemple supprimés.
- **Vue Demandes immédiate** : chips de filtrage « À traiter (N) / Toutes (N) » à la place du bouton bascule « Historique ».
- **Filtres compacts** : recherche et sélecteur d’état regroupés sur une seule ligne ; sous-titre verbeux de section retiré.
- **Espaces privés sanctuarisés** : le footer public et la barre mobile publique sont masqués sur `/artisan` et `/professionnels` pour ne plus encombrer l’écran de travail.
- **Liens d’échappement** sur les écrans de connexion et d’activation (« Revenir à l’accueil », « Accéder à mon espace professionnel »).
- **Page 404** refaite en français avec l’identité MULTISERVICES MDS (auparavant en anglais).

## Isolation complète de l’espace artisan — 5 novembre 2026 (dernière passe)

- **Redirection automatique** : l’artisan connecté (`role=admin`) est renvoyé vers `/artisan` dès qu’il tente d’accéder à une page publique ou professionnelle (accueil, prestations, demande, suivi, paiements, professionnels). Seules `/artisan`, `/profil` et les pages légales restent accessibles.
- **Header taillé pour l’artisan** : pas de liens de navigation publique, pas de « Retour client », pas de bouton d’appel MDS (l’artisan n’appelle pas l’artisan), logo liant vers `/artisan`.
- **Menu « Espaces » adapté** : pour l’artisan, suppression des entrées « Espace artisan » (redondante) et « Professionnel » ; seul « Mon profil » + « Se déconnecter » subsiste.
- **Profil artisan épuré** : masquage des sections client « Mes espaces » et « Paiements et suivi » pour l’administrateur, bouton unique « Retour à l’atelier », masquage du footer sur `/profil` pour l’artisan.
- **Écran d’activation** : retrait du lien « Accéder à mon espace professionnel ».

## Navigation artisan 1-clic et mentions légales officielles — 5-6 novembre 2026

- **Accès artisan 1-clic** : suppression de la redirection forcée de l’artisan sur les pages publiques (liberté de navigation), redirection par défaut vers l’atelier à la connexion OAuth, liens directs « Voir le site public » depuis l’atelier et dans le menu des espaces.
- **Mentions légales officielles** intégrées depuis le registre Siren (Ouest France WEB n°99884, entreprises.lefigaro.fr) : MULTISERVICES MDS, SASU au capital de 500 €, SIREN 130 201 502, SIRET 130 201 502 00015, TVA FR 68 130 201 502, RCS Rennes, code NAF 43.22G, président Mamoudou DEMBELE, 10 Rue Monsieur Vincent, 35200 Rennes.
- **Vérification de bout en bout** : scénario complet de 15 étapes exécuté avec succès (création → acceptation → confirmation → départ → GPS → arrivée → début → photos avant/après avec garde serveur → signature client → règlements → aperçu admin).
- **Tests** : 269 tests (13 fichiers), 0 échec.

## Correctif UX artisan — ouverture des dossiers sur mobile et documentation d'accès équipe (2026-11-06)

- **Diagnostic vidéo utilisateur** (`SVID_20261106_001034_1.mp4`, analysée avec `manus-analyze-video`) : les clics répétés sur les badges « À analyser » dans l'onglet artisan Demandes semblaient inopérants. Cause : la grille `split-view` (deux colonnes desktop) se replie verticalement sous 700 px, plaçant le panneau de détail sous une longue liste sans défilement ni retour visuel.
- **Master-detail responsive** : la liste artisan se cache sur mobile dès qu'un dossier est sélectionné (`artisan-list-panel--hidden-mobile`), le détail s'affiche seul en pleine largeur avec défilement vers le haut et animation d'entrée (`artisanPanelIn`), un bouton proéminent « Retour à la liste des demandes » permet de revenir à la liste. Les cartes portent désormais un indicateur explicite « Ouvrir » avec chevron. Appliqué à l'onglet Demandes (`private-artisan-requests.tsx`) et à l'onglet Interventions (`Artisan.tsx`).
- **Tests** : nouvelles assertions dans `server/mds/ui-version.test.ts` (10 tests, total 273/273 passants sur 13 fichiers), `pnpm check` et `pnpm build` OK.
- **Accès artisan** : vérifié en base — le compte artisan est déjà activé pour `ife369243@gmail.com` (Ngoyone, admin, `artisanUserId = 1`). L'artisan n'a plus rien à activer : il se connecte avec cet e-mail et atterrit directement dans `/artisan`.
- **Collaborateurs (non implémenté — conception documentée)** : le système ne gère aujourd'hui qu'un artisan unique. Les collaborateurs doivent être un rôle opérationnel distinct (accès uniquement aux interventions assignées, pas d'accès admin/finances) avec invitation par e-mail — roadmap documentée dans `GUIDE-ARTISAN.md` section 10.

## Refonte de l'espace professionnel — offre contrats d'entretien & abonnements (2026-11-06)

- **Diagnostic vidéo utilisateur** (`SVID_20261106_001505_1.mp4`, analysée avec `manus-analyze-video`) : l'utilisateur a cliqué sur « Vous êtes l'artisan MDS ? » sur l'accueil mais a vu un écran « ESPACE PROFESSIONNEL » puis a été redirigé vers l'espace artisan après connexion OAuth. Analyse : les cartes professionnelle et artisan étaient empilées sans hiérarchie claire, la page pro n'affichait aucune offre commerciale (seulement un panneau de connexion), et la redirection OAuth des admins vers l'artisan complétait la confusion.
- **Nouvelle page professionnelle publique (`client/src/pages/Professional.tsx`)** : 2 onglets — (1) « Offre professionnels & contrats » visible sans connexion : 7 secteurs ciblés (mairies, HLM, syndics, hôpitaux, écoles, centres commerciaux, entreprises), formules d'abonnement Mensuelle (sans engagement annuel) et Annuelle (tarif réduit avec remise d'engagement), formule sur-mesure grands comptes, ce qui est inclus, formulaire de demande de proposition de contrat gratuite, contacts directs ; (2) « Mon espace organisation » conservant l'espace fonctionnel complet (organisations, bâtiments, interventions, devis, factures) pour les clients pro connectés.
- **Passerelles anti-confusion** : la carte artisan sur l'accueil est désormais discrète (« Accès réservé : vous êtes l'artisan MDS ? »), la carte pro porte l'identité orange MDS ; l'écran artisan déconnecté renvoie vers `/professionnels` et l'espace pro renvoie vers `/artisan`.
- **Correction backend** : les demandes libres (serviceId null) et les demandes de contrat pro peuvent désormais être créées sans créneau même lorsque le calendrier est activé (`server/mds/requests.ts`).
- **Tests** : 16 assertions dans `server/mds/ui-version.test.ts`, 2 nouveaux tests de demande libre dans `server/mds/router.test.ts` (total 281 tests passants sur 13 fichiers), `pnpm check` et `pnpm build` OK.

## Refonte UX/UI Uber : identité officielle MDS, photos réelles, recherche, récurrence, carte artisan et fluidité (2026-11-06)

- **Identité officielle MDS intégrée** : le vrai logo fourni par le propriétaire (`1000065617.png`) remplace le faux logo SVG — versions 180/320 px PNG+WebP avec `srcSet` pour écrans 4K/retina, favicon PNG et icônes du webmanifest PWA mises à jour.
- **Accueil façon Uber Eats (`client/src/pages/Home.tsx`)** : héro avec photo réelle d'artisan (`hero-artisan.webp`), fiches confiance (« Fiable », « Rapide », « À proximité », « 1 seul artisan »), barre de localisation d'intervention (« Rennes + 30 km »), barre de recherche avec filtrage instantané des métiers/problèmes, « Catégories populaires », séparation stricte Particulier/Professionnel.
- **Séparation stricte des trois espaces** : Particulier (accueil/demande/suivi), Professionnel (offre pro + espace organisation), Artisan (atelier privé avec connexion admin requise) — aucun lien croisé trompeur.
- **Récurrence dans la demande (`client/src/pages/Request.tsx`)** : choix « Ponctuelle » vs « Abonnement (mensuel / annuel) » à l'étape 4, inclus dans la description transmise à l'artisan ; passerelle vers l'offre pro.
- **Suivi live façon Uber (`client/src/pages/Tracking.tsx`)** : carte sombre Mapbox déjà en place enrichie de la **carte d'identité de l'artisan** avec sa vraie photo (`artisan-avatar.webp`), spécialités, note 4,8 ★ et bouton d'appel direct.
- **Navigation mobile alignée maquette (`Layout.tsx`)** : Accueil, Mes demandes, Contrats (vers `/professionnels`), Mon espace/Artisan ; footer légal restauré sur la page pro.
- **Vérifications** : 289/289 tests passants (13 fichiers), `pnpm check` OK, `pnpm build` OK, assets statiques HTTP 200, 10 routes HTTP 200.

## Cartes de formules/secteurs 100% cliquables et souscription express professionnelle (2026-11-06)

- **Diagnostic vidéo utilisateur 4** (`SVID_20261106_004658_1.mp4`, analysée avec `manus-analyze-video`) : l'utilisateur tape à plusieurs reprises sur « Formule Mensuelle » (00:47-00:50) et « Formule Annuelle » (00:51-00:52) — rien ne se passe car les cartes étaient des `article` non interactifs.
- **Formules cliquables (`Professional.tsx`)** : chaque carte devient un bouton avec état `aria-pressed`, effet au survol, état sélectionné orange avec badge « Sélectionnée ✓ », un gros bouton explicite « Choisir cette formule → » à l'intérieur, et pré-sélection automatique de la formule dans le formulaire avec défilement fluide vers celui-ci.
- **Secteurs cliquables** : les 7 cartes secteurs pré-remplissent le type d'organisation et défilent vers le formulaire.
- **Souscription express 1 minute** : 4 champs obligatoires seulement (nom, organisation, téléphone, email), sélecteur de formule en pills, détails facultatifs repliés, message de confirmation avec référence et contact direct.
- **Vérifications** : 295/295 tests (13 fichiers), `pnpm check` OK, `pnpm build` OK, routes HTTP 200.

## Correctifs : héro lisible sans fond d'image, bandeau réservé aux clients, zéro débordement mobile (2026-11-06)

- **Héro accueil** : suppression du fond d'image illisible (prospectus tarifaire) au profit d'une **carte sombre contenue** (anthracite, texte blanc net, zéro artefact IA) avec le **logo officiel MDS** en carte visuelle sur desktop ; typographie 100 % lisible sur mobile et desktop.
- **Bandeau d'intervention** : `requests.mine` filtré strictement par propriété/appartenance (`listClientScoped`) pour que le bandeau « commande en cours » de l'accueil ne s'affiche plus pour l'artisan administrateur avec tous les dossiers système.
- **Débordement mobile** : `html, body { overflow-x: hidden }`, cartes pro/artisan en largeur fluide sans `white-space: nowrap` — plus aucun contenu coupé sur petit écran, fin du « obligé de décaler pour voir ».
- **Vérifications** : 297/297 tests (13 fichiers), `pnpm check` OK, `pnpm build` OK, 10 routes HTTP 200.

## Nettoyage du planning et séparation stricte des rôles dans les menus (2026-11-06)

**Problème** : l'artisan devait pouvoir supprimer les rendez-vous terminés ou inutiles de son planning, et tout semblait « mélangé » car les visiteurs voyaient l'espace artisan dans les menus comme un menu public accessible à tous.

**Corrections** :
1. **Planning artisan nettoyable** : mutation backend `calendar.deleteAppointment` (suppression d'un rendez-vous par son propriétaire, journalisée) + `calendar.cleanCompletedAppointments` (nettoyage en masse des rendez-vous terminés). Dans la vue planning : filtre de statut (« À venir » par défaut, « Tous », « Terminés »), bouton rouge de suppression par rendez-vous avec confirmation, bouton « Nettoyer les rendez-vous terminés ».
2. **Menus strictement séparés par rôle** :
   - Header dropdown non-admin : seulement « Demander un devis », « Espace professionnel », « Catalogue des prestations », « Suivi de mes demandes », « Mon profil » — aucun lien vers l'espace artisan.
   - Dropdown admin uniquement : « Atelier artisan », « Voir le site public », « Espace professionnel », « Catalogue prestations », « Mon profil ».
   - Mobile bottom nav : clients `[Accueil, Réserver, Suivi, Compte]` / admin `[Atelier, Site public, Demandes, Profil]`.
   - Carte artisan retirée du contenu public de la page d'accueil (le propriétaire conserve le lien discret « Accès artisan » dans le footer).
   - Écran de verrouillage de `/artisan` reformulé : « Accès réservé — Atelier de l'artisan », explicitement réservé au propriétaire avec passerelles vers les espaces clients. Formulaire d'activation replié dans un panneau pour ne pas perturber les visiteurs.
3. **Tests** : 302 tests passent (13 fichiers), incluant les assertions de non-exposition de l'artisan dans les menus publics, l'adaptation de la nav mobile par rôle et le nettoyage du planning.


## Correctifs UX mobile, lieux artisan et paiement sécurisé — 6 novembre 2026

Les cartes de choix de la demande ont été reprises pour empêcher les chevauchements observés sur mobile. Les problèmes peuvent maintenant être cochés en sélection multiple ; le premier reste le champ principal historique et la liste complète est conservée dans les réponses du dossier. Le logo revient toujours vers l’accueil public, un retour accueil est visible dans les pages publiques et la barre mobile est masquée pendant la demande afin de ne plus recouvrir le formulaire.

L’espace artisan reçoit une carte des lieux d’intervention construite à partir des adresses réelles des demandes et géocodée par Mapbox ; aucune position GPS n’est inventée. Le paiement est précédé d’une connexion obligatoire dans l’interface et le serveur bloque l’ouverture d’un paiement Stripe live sans identité authentifiée en production. Le lien privé de suivi reste accessible sans compte, mais il ne permet pas de contourner la protection du paiement.


## Authentification locale MDS — 6 novembre 2026

Une page `/connexion` distingue maintenant la connexion et la création de compte. Le compte local demande prénom, nom, type particulier ou professionnel et mot de passe d’au moins dix caractères. Le rôle artisan/admin reste réservé au mécanisme d’accès MDS existant et ne peut pas être choisi dans un formulaire public. Les comptes Google ne sont pas simulés : l’intégration est volontairement reportée.

Les mots de passe sont traités par scrypt avec sel aléatoire et comparaison résistante au timing. Les sessions locales sont des jetons opaques hashés en base, placés dans un cookie HTTP-only sécurisé, avec expiration et verrouillage temporaire après plusieurs échecs. OAuth Manus reste disponible dans un panneau secondaire pour le compte gestionnaire existant.


## Qualification opérationnelle initiale — 6 novembre 2026
Le parcours de demande permet désormais de préciser un niveau d’urgence standard ou urgent. Cette information reste dans le dossier existant, sans migration destructive ni confirmation automatique. Dans l’espace artisan, les demandes urgentes encore à traiter remontent en premier et portent un badge explicite. Le message rappelle que l’urgence ne remplace pas la vérification réelle de la zone, du planning et de la capacité de l’artisan. La liste d’attente persistante, la messagerie client-MDS et les règles de surcharge restent ouvertes pour une prochaine étape.


## Liste d’attente persistante — 6 novembre 2026
Le formulaire propose maintenant une liste d’attente explicite lorsque le client ne peut pas retenir un créneau. Le serveur conserve une entrée relationnelle liée au dossier, sans date ou rendez-vous fictif. L’artisan retrouve ces demandes dans l’onglet Demandes et peut ouvrir le dossier pour proposer ultérieurement un créneau réellement contrôlé par le calendrier. Les transitions contactée/convertie et les notifications de disponibilité restent à compléter.


## Carte interactive des lieux d’intervention — 6 novembre 2026
La carte de l’onglet Planning artisan est maintenant recherchable par client, adresse, code postal, ville ou prestation. Elle géocode les adresses réelles via Mapbox, actualise les résultats à la demande et affiche une liste de résultats ouvrant directement le dossier sélectionné. Une adresse non localisable est ignorée sans bloquer les autres. Le regroupement de marqueurs et le cache serveur restent à prévoir si le volume augmente.
