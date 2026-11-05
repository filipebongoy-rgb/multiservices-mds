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

Le trajet devra suivre les étapes `Démarrer le trajet` → position réellement autorisée et envoyée → `Je suis arrivé` → `Commencer l’intervention`. La première tranche enregistre déjà les points GPS uniquement pendant `en_route`, expose la dernière position au client autorisé, actualise la carte toutes les dix secondes et arrête l’envoi dès que le statut quitte le trajet. Le partage reste limité au dossier courant, protégé côté serveur et horodaté. En cas de refus GPS ou perte réseau, le système conserve le statut et ne fabrique jamais une position ou une ETA. L’itinéraire routier, la notification d’approche, la conservation limitée des points et le suivi en arrière-plan restent à compléter dans la tranche suivante.
