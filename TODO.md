> Les critères initiaux demeurent conservés ci-dessous comme historique. La consigne UX complémentaire remplace leurs sept menus et photographie par trois rubriques principales et un accueil sans décoration. Le statut des activations externes fait foi dans la section PROMPT 2/3.

# MULTISERVICES MDS — Résultats attendus

- [x] Application unique full-stack réelle, évolutive et sécurisée. Frontend responsive, API/backend, MySQL, utilisateurs/clients/organisations/sites/prestations/tarifs/demandes/interventions/disponibilités/rendez-vous/documents/notifications/paramètres, journal sensible. Un seul artisan ; aucun réseau, distribution, recrutement ou équipe d’artisans. Comptes particuliers, organisations et collaborateurs autorisés ; isolation des organisations côté serveur. Authentification réelle, aucune donnée fictive comme réelle.
- [x] Identité originale anthracite/blanc/orange cuivre, typographie lisible, photo métier réaliste illustrative, icônes professionnelles, interface épurée mobile-first ; pas de copie graphique Doctolib, emojis, animations décoratives, dégradés excessifs, cartes surdimensionnées, textes interminables, boutons inutiles ou fausses statistiques. Accueil court avec recherche, métiers, « Prendre rendez-vous », « Je ne trouve pas mon problème », suivi.
- [x] Parcours particulier sans compte imposé, une action principale/écran, question progressive, 3 clics lorsque possible sans sacrifier données requises, pas de jargon ou long formulaire, grands boutons, lisibilité, navigation évidente, saisie conservée. Cible WCAG 2.2 AA adaptée aux personnes âgées : labels, focus, contraste, zoom, états et erreurs accessibles ; audit de conformité complet non présumé.
- [x] Catalogue administrable MÉTIER → PRESTATION → TYPE DE PROBLÈME. Familles initiales plomberie (fuite, débouchage, robinetterie, lavabo/évier, WC, chasse d’eau, douche/baignoire, chauffe-eau, raccordements), électricité (panne, prises, interrupteurs, éclairage, tableau, mise en sécurité, VMC), chauffage (panne, radiateurs, chaudière, thermostat, entretien, circuit), peinture (murs, plafonds, portes, préparation, rebouchage, ponçage, rénovation), petits travaux/maintenance (montage, fixations, réglages, petites réparations, entretien). Toutes inactives par défaut ; base de configuration, pas déclaration commerciale. Artisan peut ajouter, modifier, désactiver, supprimer sans détruire dossiers existants. Description, photo, tarif/règle devis, durée, questions, conditions, zone et statut ; rien de non validé réservable.
- [x] Demande libre « Je ne trouve pas mon problème » partout catalogue accessible ; texte, dictée si navigateur compatible, photo facultative privée ; conserver même problème non reconnu, état interne « À analyser » ; jamais bloquer faute de correspondance.
- [x] Double validation réelle particuliers/professionnels : client service/problème/photos/adresse/créneau souhaité → en attente MDS ; artisan acceptation un clic si tarif/créneau définis, refus, autre créneau, informations/diagnostic/devis ; client accepte/refuse proposition, autre créneau, devis accepté/refusé distinctement ; aucun RDV définitif avant deux validations. Chaque action met à jour dossier ; protection doubles confirmations et concurrence, synchronisation des espaces.
- [ ] Statuts précis : Brouillon, Demande envoyée, En attente MDS, Acceptée MDS, Proposition de créneau, Informations demandées, En attente confirmation client, Confirmée, Refusée, Annulée, Planifiée, En cours, Terminée, Facture émise, Paiement confirmé, Clôturée. Historique horodaté de tous changements et actions, gestion refus/annulations/délais, expiration configurable et notifications internes automatiques ; pas d’envoi email/SMS prétendu. Suivi visuel uniquement d’événements réels ; prochaines actions utiles artisan.
- [x] Espace professionnel entreprises/syndics/bailleurs/gestionnaires/associations/collectivités : créer organisation, plusieurs sites, contacts autorisés, déclarer/consulter interventions, consulter devis/factures/contrats propres ; isolation stricte. Aucune organisation de démonstration.
- [x] Espace artisan protégé : Aujourd’hui, Demandes, Planning, Devis, Clients, Factures, Paramètres ; écran immédiat, navigation courte. Traitement rapide et détails organisés sans recopie. Aucun contournement d’authentification en Preview.
- [x] Documents/photos chiffrés en stockage durable, index en base, autorisation téléchargement serveur, limites/taille/type, pas d’URL de contenu sensible public ni de stockage local durable fictif.
- [ ] Évaluations bilatérales avec note/commentaire facultatif, authentifiées, liées à intervention réelle terminée, anti-doublon, privées par défaut avec modération ; pas d’avis publics automatiques.
- [x] Fondations testées via diagnostics/tests et agent de validation en lecture seule : navigation, catalogue, demande, professionnel, artisan, permissions, mobile et transitions. Compte rendu exact des éléments développés, simulés et problèmes ; continuité du même projet prompt 2/3 (planning avancé/canaux externes/automatisations autonomes restant explicites).

## État précis à la remise

Les éléments cochés correspondent à des mécanismes implémentés, raccordés et contrôlés par diagnostics, tests et inspection. Les parcours avec les vrais comptes de MDS et de vrais dossiers restent à recetter ; les tests n’ont pas injecté de faux clients dans la base partagée. Consulter `docs/COMPTE_RENDU.md` pour distinguer développement, tests par doubles et validation utilisateur.

L’item statuts/notifications est livré pour la machine, l’historique et les notifications internes ; il reste ouvert pour l’expiration autonome sans trafic et les canaux externes. L’item évaluations est livré pour notes privées authentifiées/anti-doublon ; il reste ouvert pour une interface complète de modération. Le suivi contractuel est un index documentaire ; les cycles contractuels avancés restent ouverts. La cible AA est prise en compte, pas certifiée.

## Poursuite — brief hybride définitif

- [x] Deux modes tarifaires explicites administrables, MODE A prix affiché pour prestation standardisée, MODE B devis personnalisé pour besoin complexe/diagnostic. Changement de mode depuis administration. Prix applicable, inclusions, exclusions, éventuels déplacements, durée indicative et conditions visibles. Calcul uniquement depuis règles administrateur ; jamais prix/supplément/estimation ferme inventés. Préserver anciens dossiers et données MDS existantes.
- [x] Le client envoie au tarif annoncé : calcul serveur de base+déplacement, détail figé au dépôt, contrôle changement de règles entre lecture et envoi, pas de supplément silencieux. Code postal sans tarif couvert reste demande conservée sur devis. Demande sur devis personnalisée ne peut être acceptée comme intervention ferme sans devis réel accepté puis confirmation du créneau. Un changement de prix hors forfait doit passer par nouveau devis accepté.
- [x] Paiements : entité relationnelle et API, historique à montant/devise/date/statut, permission par dossier/organisation, Checkout serveur lié à facture émise réelle et montant contractuel, distinction mode test/encaissement commercial ; événements signés/idempotents, montant exact et devise vérifiés, aucun succès inféré du retour navigateur, aucune donnée carte conservée. Paiement manuel vérifié conservé distinctement. Pas de débit réel dans les tests.
- [x] Simplicité pour utilisateur de 80 ans : conserver questions progressives sans compte, mais préremplir site professionnel/adresse/contact autorisés déjà connus ; limiter recopie et clics inutiles. Sources communes et tests des parcours mobiles, rapport de fonctions exactes, aucune offre fictive activée ; source et projet uniques pour suite prompt 2/3.

Preuves de cette poursuite : `pnpm check`, 124 tests en six fichiers, build de production, API Stripe test en lecture seule, refus HTTP du webhook non signé, captures desktop/mobile et revue ciblée suivie de corrections. La recette avec comptes/dossiers réels et la livraison provider du webhook restent à réaliser ; aucun paiement réel ni faux dossier de production créé. Rapport : `docs/COMPTE_RENDU_HYBRIDE.md`.

## PROMPT 2/3 — Moteur opérationnel

- [x] Réutiliser le même projet, utilisateurs, base et composants. Parcours prestation/besoin/adresse/créneau/demande → notification MDS → acceptation/refus/alternative → notification et acceptation/refus client ; demande envoyée jamais réservation confirmée. Doubles validations, prix/durée/conditions figés, permissions et historique conservés.
- [x] Réponses artisan rapides Accepter, Refuser, autre créneau, photo, précision, diagnostic, préparer devis ; réponse en quelques secondes quand données suffisantes. Client choisit une alternative réellement proposée, consulte/accepte/refuse devis distinct de confirmation du rendez-vous. Expiration configurable et rappels.
- [x] Modes prix fixe et devis appliqués : prix, inclus/exclus/frais/total/conditions et accord client ; accord artisan toujours requis. Devis structuré compréhensible avec données émetteur/client/référence/date/lignes/taxes/validité/conditions/paiement, PDF privé réel et acceptation/refus tracés ; ne pas prétendre certification juridique. Aucun supplément/travail additionnel facturé sans information et accord préalable.
- [x] Calendrier central artisan unique : horaires, congés/blocages, disponibilités explicites, durée, déplacement, zones postales, rendez-vous confirmés, marges de sécurité. Créneau souhaité/proposé non réservé ; vérification transactionnelle et anti-double réservation au moment de confirmation, sans horaires/offres fictifs.
- [x] Qualification IA native langage naturel : prestation probable parmi offres validées, informations manquantes, questions utiles une à une. Incertitude ou erreur conserve demande libre pour MDS ; jamais diagnostic, prix ou confirmation inventés. Consentement/information avant transmission sans coordonnées inutiles.
- [x] Suivi chronologique fondé sur événements réels : demande envoyée, attente MDS, accord MDS, proposition, attente client, RDV confirmé, planifié, artisan en route seulement après départ déclaré, en cours, terminé, facture, paiement confirmé, clôturé. Synchronisation des espaces et lien privé sécurisé sans application obligatoire.
- [x] Intervention : adresse/contacts/description/photos/prestation/devis/conditions acceptés accessibles ; Démarrer, problème, travaux supplémentaires, Terminer. Supplément avec périmètre/prix/accord préalable et contrôle serveur avant exécution ; pas d’exception juridique automatique. Incidents refus/expiration/absence de créneau/annulation/client absent/artisan indisponible/paiement échoué/devis refusé/supplément/réclamation horodatés, historique et résolution/reprise manuelle auditée.
- [x] Paiement réel Stripe : intégral/acompte/solde/liens/confirmation/échec/remboursement lorsque applicable/historique. Montants server et registres test/live distincts ; aucun succès sur redirect, pas de portefeuille ni cartes conservées. Remboursement uniquement confirmation provider, contrôle identité/montant/devise/concurrence et absence de remboursement commercial de test.
- [ ] Notifications e-mail et SMS préparées avec fournisseurs choisis/configurés : demande reçue/acceptée/proposition/nouveau créneau/devis/accord-refus/confirmation/rappel/départ/fin/facture/paiement ; messages courts utiles. File durable et dédupliquée, preuve du statut provider, retry/reprise sans fausse livraison ; canaux non configurés explicitement inactifs.
- [ ] Automatisation native : callback authentifié idempotent, expirations et rappels sans trafic une fois déployé/activé, tâche identité persistée et journaux ; activation autonome dépend de publication autorisée, pas de substitution par timer local de sandbox. Traitement manuel artisan pour reprise, pas de cron activé sans URL publiée.
- [x] Tests des deux modes : fixe/devis/refus/nouveau créneau/accord-refus client/expiration/annulation/paiement/intervention terminée, transitions, cohérence des données, anti-doublons et contrôles complémentaires. Diagnostics/build et revue indépendante ciblée sans faux dossiers production ; compte rendu réel et préparation PROMPT 3/3 gestion professionnelle/contrats/admin/audit.

## Priorité UX — consigne complémentaire
- [x] Même application web responsive mobile-first, profils adaptés sans trois logiciels. Accueil logo + « Un problème chez vous ? On s’en occupe. » + description + cinq métiers + demande libre, sans longs textes répétitifs.
- [x] Parcours courant en trois actions : besoin, adresse et créneau, envoi. Conserver contacts/sites connus, tarif hybride et consentements indispensables ; aucune question facultative bloquante. Questions utiles une par une, pas de long formulaire ni lecture inutile.
- [x] Maximum trois entrées de navigation par espace. Artisan : Demandes/Planning/Interventions, réponse principale Accepter/Refuser/Autre créneau ; outils secondaires contextuels repliés. Professionnel : déclarer/sélectionner bâtiment/suivre avec uniquement infos utiles ; contacts/contrats/documents existants préservés en arrière-plan.
- [x] Analyser les écrans existants avant modification, améliorer accueil existant sans écrans artificiels ; gros boutons lisibles personnes âgées, aucune décoration ni tableau inutile. Moins de lecture, clics et décisions ; automation réelle ou honnêtement en attente de configuration.

État PROMPT 2/3 : moteur, UI simplifiée et callbacks développés ; 255 tests en 12 fichiers passent, diagnostics et build propres. Notifications/callbacks testés en mémoire et rejeux contrôlés, IA réelle vérifiée sans dossier. Les deux items ouverts requièrent encore choix/paramètres fournisseurs et publication/tâche native autorisées, pas une simulation. Rapport actuel : `docs/COMPTE_RENDU_PROMPT2.md`.

## PROMPT 3/3 — Espace professionnel, administration, paiements et sécurité

- [ ] Espace professionnel complet dans la même application : entreprises, syndics, bailleurs, associations et collectivités peuvent créer une organisation, enregistrer plusieurs bâtiments/adresses, ajouter des collaborateurs autorisés, déclarer une intervention, suivre les demandes et consulter uniquement leurs devis, factures et contrats. Chaque lecture et écriture vérifie l’appartenance côté serveur.
- [ ] Gestion client sans doublon : créer ou retrouver une fiche après première demande avec coordonnées, historique des demandes, adresses d’intervention, devis, factures, paiements et échanges ; ne jamais fusionner automatiquement des personnes sur une correspondance incertaine.
- [ ] Contrats professionnels : enregistrer contrat, sites couverts, prestations/conditions, périodes, échéances, renouvellement, suspension et fin ; versionner les changements, notifier seulement via canaux actifs et auditer les opérations sensibles.
- [ ] Devis et factures finalisés : l’artisan peut préparer, modifier avant émission, ajouter les frais configurés, transmettre, recevoir acceptation/refus et générer la facture après intervention ; PDF professionnel privé avec mentions légales provenant uniquement de la configuration MDS, sans inventer d’informations ni présenter une certification juridique inexistante.
- [ ] Administration contextuelle artisan : gérer prestations proposées, prix fixes, mode devis, durées, zones, horaires, congés, frais de déplacement, identité légale, documents et notifications ; activer/désactiver une prestation sans intervention technique ; préserver les dossiers historiques et la navigation courte.
- [ ] Paiements et confidentialité : conserver intégral/acompte/solde, suivi des transactions et remboursements déjà développés ; aucun paiement réussi sans confirmation réelle du prestataire, aucune carte bancaire stockée, aucun mode test présenté comme encaissement commercial.
- [ ] Notifications honnêtes : préparer e-mail/SMS pour nouvelle demande, décision MDS, proposition, confirmation, rappel, devis, fin, facture et paiement ; file durable, déduplication, reprise et preuve du statut fournisseur ; canal non configuré explicitement inactif.
- [ ] Sécurité/RGPD et fiabilité : authentification, rôles, isolation organisations, liens de suivi temporaires, journal d’actions, sauvegardes/configuration de restauration, protection des accès, politique de conservation et suppression physique des objets lorsque possible, sans exposer de contenu supprimé.
- [ ] Audit final : tester particulier demande→acceptation→confirmation→intervention→facture→paiement ; professionnel connexion→bâtiment→demande→suivi→devis→facture ; artisan réception→décision→planning→intervention→clôture. Vérifier erreurs, doublons, annulations, intégrations externes indisponibles, transitions et doubles exécutions ; ne pas déclarer opérationnelle une fonction simulée.

État de cette tranche : rapprochement serveur prudent des fiches clients, consultation artisan et édition contrôlée des contrats intégrés ; cycles contractuels avancés, gouvernance RGPD, audit enrichi, modération, liens documentaires temporaires et recette réelle restent ouverts. Les fournisseurs e-mail/SMS, Stripe live, publication et tâche autonome native restent désactivés jusqu’à configuration et autorisation réelles. Rapport : `docs/COMPTE_RENDU_PROMPT3.md`.

## PROMPT 7/8/9 — Suivi Uber, sécurité des paiements, espace admin, signature client

- [x] Compte artisan activé (Ngoyone = admin, artisanUserId=1), zone Rennes 30 km et coordonnées préconfigurées, calendrier activé avec zones de déplacement.
- [x] Hero d’accueil corrigé : texte blanc lisible, dégradé professionnel, suppression du figcaption amateur.
- [x] Raisons d’échec Stripe capturées et stockées sur chaque paiement ; audit des connexions utilisateurs.
- [x] Routeur admin MDS avec KPI, dernières connexions, demandes complètes, paiements et échecs détaillés.
- [x] Notification push propriétaire (Manus notifyOwner) pour chaque nouvelle demande et action client.
- [x] Onglet Activité / Admin dans l’espace artisan avec tableau de bord complet (connexions, demandes, paiements, échecs) — 2 tests dans `router.test.ts`.
- [x] Bannière d’alerte demandes en attente et guide de réponse rapide dans l’espace artisan.
- [x] Signature du client sur l’écran en fin de chantier (canvas tactile, stockage chiffré, affichage preuves et dossier artisan) — tests `confirmCompletion` avec `signatureDataUrl` dans `router.test.ts`.
- [x] Signature tactile artisan en accès direct (bouton « Faire signer le client sur cet écran », modal dédié, guide tactile, cibles 48 px minimum) — composant `SignaturePad` avec `touchAction: "none"`, touch events réels et aperçu chiffré.
- [x] Bannière pro (« Vous êtes une entreprise ou une collectivité ? ») et footer restaurés sur l’accueil pour compléter la fidélité à la maquette MDS — `Home.tsx` + `simple-ux.css`.
- [x] Audit comparatif de l’expérience client vs la maquette MDS (8 écrans) et les principes Uber Eats officiels — rapport : `docs/AUDIT-EXPERIENCE-CLIENT.md`.


## Correctifs UX mobiles et paiement — 6 novembre 2026
- [x] Les choix de métier et de problème restent lisibles sur mobile : titre, explication et action ont des colonnes séparées, sans texte superposé ; plusieurs problèmes peuvent être sélectionnés et sont conservés dans `answers.__problemTypes`, avec le premier choix comme problème principal compatible avec le moteur existant.
- [x] Le logo revient vers l’accueil public et les pages publiques disposent d’un retour accueil explicite ; la barre mobile ne recouvre plus le formulaire de demande.
- [x] L’espace artisan dispose d’une carte des lieux d’intervention fondée sur les adresses réelles des dossiers et Mapbox configuré, sans position inventée ; une adresse non localisable ne bloque pas les autres.
- [x] Le paiement sécurisé demande une connexion dans l’interface ; en production avec Stripe live, le serveur refuse aussi l’ouverture Stripe sans compte authentifié. Le suivi privé reste accessible sans compte.


## Authentification MDS locale — 6 novembre 2026
- [x] Une page `/connexion` distingue la connexion et la création de compte. L’inscription demande prénom, nom, type de compte particulier ou professionnel et mot de passe d’au moins 10 caractères. Le rôle artisan/admin n’est jamais sélectionnable publiquement.
- [x] Les mots de passe sont hashés par scrypt avec sel aléatoire ; les sessions locales utilisent un jeton opaque hashé en base, cookie HTTP-only, SameSite=None et durée limitée. Les tentatives répétées sont temporairement bloquées.
- [x] OAuth Manus est conservé pour l’accès gestionnaire MDS existant. Google est explicitement laissé pour une intégration ultérieure ; aucun bouton Google fictif n’est présenté.


## Qualification opérationnelle initiale — 6 novembre 2026
- [x] Le client peut déclarer un niveau d’urgence standard ou urgent dans la demande ; la valeur est conservée dans le dossier sans modifier les contrats existants.
- [x] L’espace artisan trie les demandes urgentes nécessitant une action avant les autres et affiche un badge « Urgent » visible.
- [x] Le parcours rappelle qu’un niveau urgent ne confirme jamais automatiquement une intervention : la capacité réelle, la zone et le planning doivent être vérifiés par MDS.
- [ ] Restent à développer : liste d’attente persistante, messagerie client-MDS, règles administrables de surcharge et questions complémentaires ciblées.


## Liste d’attente persistante — 6 novembre 2026
- [x] Si aucun créneau ne convient, le client peut choisir « Rejoindre la liste d’attente » dans l’étape Disponibilités. La demande est envoyée sans date inventée et sans réservation.
- [x] Une table `mds_waitlist_entries` conserve la demande, le motif, le statut d’attente et le créneau souhaité éventuel. La migration additive a été appliquée.
- [x] L’artisan voit les clients en attente dans l’onglet Demandes ; un clic ouvre le dossier correspondant. Le texte rappelle qu’un créneau réellement libre doit être proposé.
- [ ] Restent à développer : changement de statut contacté/converti depuis l’interface, notifications de disponibilité et règles de priorité administrables.


## Carte interactive des lieux d’intervention — 6 novembre 2026
- [x] L’onglet Planning de l’espace artisan affiche une carte Mapbox fondée sur les adresses réelles des demandes, sans coordonnées inventées.
- [x] Une recherche permet de filtrer par nom du client, adresse, code postal, ville ou prestation ; un bouton Actualiser relance le géocodage des adresses disponibles.
- [x] Les résultats de recherche sont cliquables et ouvrent directement le dossier correspondant ; une adresse non localisable ne bloque pas les autres résultats.
- [ ] Restent à développer : regroupement de marqueurs à grande échelle et géocodage serveur mis en cache pour limiter les appels Mapbox.


## Correction inscription et activation administrateur — 7 novembre 2026
- [x] La création de compte demande désormais une adresse e-mail, en plus du prénom, du nom et du mot de passe.
- [x] Les erreurs de doublon SQL ne sont plus affichées brutes à l’utilisateur ; elles deviennent un message clair indiquant qu’un compte existe déjà.
- [x] La promotion administrateur fonctionne aussi après inscription ou connexion locale, et pas seulement avec OAuth.
- [x] Le compte local existant « Filipe Bongoy » a été rattaché à `filipe.bongoy@gmail.com`, marqué administrateur et associé à son invitation active. Il doit se déconnecter puis se reconnecter pour renouveler sa session.


## Espace compte complet — 7 novembre 2026
- [x] La page Profil permet de modifier le nom affiché, l’adresse e-mail, le type d’espace particulier/professionnel, le téléphone et l’adresse complète.
- [x] Une rubrique Sécurité permet de modifier le mot de passe des comptes locaux avec vérification de l’ancien mot de passe et hashage scrypt.
- [x] La déconnexion est visible en haut de la page et fonctionne en un clic.
- [x] La suppression du compte est protégée par la saisie exacte de « SUPPRIMER ». Elle anonymise les données personnelles, supprime les identifiants locaux et conserve uniquement les données nécessaires à l’historique légal. Le dernier administrateur propriétaire ne peut pas supprimer l’accès MDS depuis son profil.


## Séparation stricte client / équipe MDS — 7 novembre 2026
- [x] Un client connecté conserve uniquement sa navigation : Accueil, Réserver, Suivi et Compte. Les onglets Demandes, Planning, Interventions, Règlements et Activité ne lui sont pas présentés.
- [x] La page `/artisan` ne montre plus de formulaire de code d’activation à un client connecté ; elle explique que l’accès est réservé à l’équipe et renvoie vers les espaces client ou professionnel.
- [x] Le lien public « Accès artisan » a été retiré du footer des visiteurs et clients. Les administrateurs voient seulement « Accès équipe MDS ».
- [x] Après connexion, un administrateur autorisé arrive directement dans l’atelier ; un client arrive dans son profil ou revient à la page demandée.
- [x] Les actions de traitement des demandes ne vérifient plus uniquement l’ancien propriétaire : tout administrateur MDS autorisé peut réellement ouvrir et traiter les demandes.


## Inscription sécurisée — 7 novembre 2026
- [x] L’adresse e-mail est obligatoire à la création du compte et doit respecter un format valide.
- [x] Le mot de passe est obligatoire avec un minimum de 10 caractères.
- [x] Le champ « Confirmer le mot de passe » est obligatoire ; l’interface bloque l’envoi si les deux valeurs diffèrent et le serveur vérifie aussi leur égalité.


## Alertes urgentes artisan — 7 novembre 2026
- [x] L’espace artisan vérifie les nouvelles demandes toutes les 10 secondes lorsque l’atelier est ouvert.
- [x] Une nouvelle demande active marquée urgente affiche une alerte persistante « Nouvelle demande urgente », avec prestation, client et bouton « Ouvrir ».
- [x] La première récupération ne déclenche pas d’alerte répétée pour les demandes déjà existantes ; une demande devient alertable lorsqu’elle apparaît ou passe à l’état urgent.
- [x] L’alerte peut être fermée, et le compteur/prochaine action restent disponibles dans l’onglet Demandes.
- [x] Le fonctionnement est documenté honnêtement comme une actualisation courte côté navigateur, et non comme une connexion WebSocket permanente.


## Géolocalisation des interventions urgentes — 7 novembre 2026
- [x] La carte Planning propose le filtre « Urgentes uniquement » avec le nombre de demandes urgentes localisables.
- [x] Les demandes urgentes utilisent un marqueur rouge et affichent un badge « Urgent » dans la liste ; cliquer sur un lieu ouvre directement le dossier.
- [x] Le bouton « Ma position » demande l’autorisation GPS du navigateur, ajoute un repère local et recentre la carte. La position n’est ni enregistrée ni envoyée au serveur par cette fonctionnalité.
- [x] Une adresse impossible à géocoder ne bloque pas les autres interventions. Le trajet GPS réel reste séparé et ne démarre qu’après l’action artisan correspondante.


## Branchement visible alerte urgente → carte — 7 novembre 2026
- [x] Depuis l’alerte « Nouvelle demande urgente », le bouton « Voir sur la carte » ouvre directement l’onglet Planning et active automatiquement le filtre « Urgentes uniquement ».
- [x] Le changement de filtre relance réellement le géocodage et la liste des marqueurs ; il ne s’agit plus seulement d’un contrôle visuel non branché.


## Identifiant e-mail uniforme — 8 novembre 2026

L’inscription demande désormais l’adresse e-mail, la connexion utilise cette même adresse avec le mot de passe, et le profil impose un e-mail valide lors de chaque enregistrement. Le serveur normalise les adresses en minuscules et refuse qu’une adresse soit utilisée par un autre compte. Les comptes locaux conservent leur clé technique historique pour compatibilité, mais l’utilisateur n’a plus à connaître ni prénom ni nom pour se connecter.


## Sécurité du changement de mot de passe — 8 novembre 2026

Le profil demande maintenant le mot de passe actuel, un nouveau mot de passe d’au moins 10 caractères et sa confirmation. Le serveur refuse toute différence entre les deux nouveaux mots de passe ; le bouton reste désactivé tant que la confirmation n’est pas correcte.


## Correction globale des en-têtes mobiles — 8 novembre 2026

Le header de la demande ne rend plus un second titre « Demande d’intervention ». Le titre est affiché une seule fois dans le contenu, sous le bouton de retour. Une règle responsive finale réserve l’espace du header, empêche le recouvrement et conserve le titre lisible sur petits écrans. Les contrôles recherchent aussi les régressions similaires dans les règles de navigation et les titres.


## Nouvelles prestations ventilation et sécurité — 8 novembre 2026

Le catalogue MDS comprend maintenant quatre prestations actives dans le métier Électricité : installation de VMC, entretien de VMC, installation de détecteur de fumée et entretien de détecteur de fumée. Elles sont proposées sur devis après analyse, dans la zone Rennes et métropole jusqu’à 30 km selon l’adresse. Aucun prix ou créneau fictif n’est affiché.


## Passe globale interface et interactions — 8 novembre 2026

Toutes les pages bénéficient maintenant d’une finition commune non destructive : entrée progressive courte, transitions de boutons, retour tactile, survols discrets des cartes et focus visibles. Les animations sont désactivées automatiquement avec `prefers-reduced-motion`, et le mobile ne reçoit pas d’effet de déplacement au survol. Les styles historiques des parcours client, professionnel et artisan sont conservés.
