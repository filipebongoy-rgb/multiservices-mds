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
