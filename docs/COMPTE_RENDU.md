# MULTISERVICES MDS — Compte rendu des fondations

Version du 5 novembre 2026 · Prompt 1/3 et modification structurante de double validation.

L’application est développée dans un projet unique, avec frontend React/TypeScript, serveur Express, API tRPC et base MySQL relationnelle gérée par Manus. La double validation est intégrée au moteur métier : **l’accord de MDS ne crée jamais, à lui seul, un rendez-vous définitif**. Cette version est consultable dans la Preview du projet. Elle ne constitue pas encore une ouverture commerciale et n’est pas publiée automatiquement.

## Fonctionnalités réellement développées

### Site public et demande sans compte

L’accueil comporte une identité MDS originale anthracite, blanc et orange brûlé, une recherche, les cinq familles de métiers, un accès au catalogue, « Prendre rendez-vous », « Je ne trouve pas mon problème » et le suivi. Le visuel de l’accueil est une illustration photographique générée, explicitement identifiée comme telle ; il ne prétend pas représenter le véritable artisan ou une intervention MDS.

Le catalogue public est alimenté par la base et ne retourne que les prestations actives, validées par l’administrateur. Les 34 prestations des cinq familles demandées ont été initialisées **inactives**, avec prix non renseigné et durée de configuration de 60 minutes. Cette durée n’est pas annoncée comme une estimation validée pour des offres encore fermées. Aucune prestation ne peut être activée sans description, zone et tarif ou règle de devis. Les données de configuration ne sont pas des déclarations commerciales.

Le parcours de demande fonctionne sans création de compte. Il présente progressivement le problème, les questions de la prestation lorsqu’elles existent, une photo facultative, l’adresse, un créneau souhaité facultatif, le nom, l’e-mail, le téléphone, puis le récapitulatif et le consentement. La demande libre est enregistrée au statut interne « À analyser », même sans correspondance au catalogue. Les champs sont validés côté client et serveur.

La saisie est conservée dans la session du navigateur et supprimée après l’envoi réussi. Une photo n’est pas conservée dans le brouillon après rechargement. La dictée utilise la reconnaissance vocale du navigateur lorsqu’elle est disponible ; l’utilisateur peut toujours écrire. Aucun audio n’est conservé par MDS. La demande est conservée même si l’ajout ultérieur de la photo échoue, avec une possibilité de réessayer sur l’écran de confirmation.

À l’envoi, l’application fournit une référence et un lien privé de suivi. La référence seule ne permet pas de lire les coordonnées d’un particulier. Le lien contient une clé forte dans son fragment, pas dans les paramètres envoyés au serveur par la navigation. Il doit être conservé et ne pas être partagé publiquement. Aucun e-mail de confirmation n’est prétendu envoyé.

### Double validation, devis et suivi

L’artisan peut accepter une demande en un clic si un prix et un créneau futur sont déjà définis. Sinon, il peut préciser une proposition avec prix, créneau, durée et message. Il peut également refuser, demander des précisions, proposer un autre créneau ou soumettre un devis réel. Les refus et les demandes d’informations sont enregistrés dans le dossier.

Le client peut accepter ou refuser la proposition, demander un autre créneau, répondre aux questions et accepter ou refuser le devis. **L’acceptation du devis et la confirmation du rendez-vous sont distinctes.** Le devis doit correspondre à un document effectivement déposé ; un document déjà utilisé ne peut pas être présenté comme un nouveau devis. Le créneau n’est réservé qu’à la confirmation client requise après l’accord de MDS et, le cas échéant, l’acceptation du devis.

Le moteur vérifie les conflits avec les rendez-vous existants et les blocages enregistrés. Il utilise des transactions, un verrou commun à l’unique artisan, une version de dossier et des contraintes d’unicité. Deux confirmations simultanées ne créent pas deux rendez-vous pour le même dossier. Deux dossiers concurrents ne peuvent pas réserver un créneau qui se chevauche. Une action sur une version périmée est refusée. Le dépôt de demande est également protégé contre les doublons au moyen d’une clé d’idempotence.

Les statuts couvrent notamment l’envoi, l’attente MDS, l’analyse, l’accord MDS, les propositions de créneau, les informations complémentaires, le devis, l’attente client, la confirmation, la planification, le refus, l’annulation, l’expiration, l’intervention en cours, la fin, la facture, le paiement vérifié et la clôture. Les actions et changements sont horodatés. Le suivi visuel n’affiche que des événements effectivement enregistrés. Il s’actualise toutes les 10 secondes lorsqu’il est ouvert ; ce n’est pas une connexion de notifications push.

Un rendez-vous annulé est présenté comme annulé, et un devis expiré n’est plus proposé à l’acceptation. L’expiration des propositions est configurable, avec une valeur de configuration initiale de 72 heures. Elle est vérifiée et enregistrée à la consultation ou lors d’une action. L’événement d’expiration reste enregistré même si la tentative d’action est refusée.

### Espace artisan

L’espace privé comprend les sept rubriques prévues : Aujourd’hui, Demandes, Planning, Devis, Clients, Factures et Paramètres. Les compteurs sont calculés sur les dossiers réels ; aucun faux chiffre d’activité n’est ajouté.

Les dossiers réunissent problème, adresse, coordonnées, photos/documents, propositions, réponses, historique et actions suivantes. Le planning présente les rendez-vous réellement confirmés, avec filtrage par date. Les clients sont regroupés à partir des demandes reçues, sans fichier de démonstration.

Le catalogue est administrable : ajout, modification, activation, désactivation et retrait d’une prestation, avec description, photo par URL autorisée, prix ou règle de devis, durée, types de problèmes, questions spécifiques, conditions et zone. Le retrait est non destructif pour les anciens dossiers. Les changements de tarif sont historisés. Les coordonnées, l’identité légale, la zone et le délai de proposition sont configurables. Les notifications internes et le journal des actions sensibles sont consultables.

Les devis et factures sont de vrais PDF déposés par l’artisan, pas des documents générés automatiquement. L’émission d’une facture exige un document. Le statut « Paiement confirmé » exige une vérification explicite et justifiée par l’artisan ; **l’application n’encaisse pas le paiement**. La clôture intervient après cette vérification.

### Espace professionnel

Les organisations peuvent être créées pour les entreprises, syndics, bailleurs, gestionnaires, associations et collectivités. Elles disposent de sites et de contacts sur place, de collaborateurs autorisés, de demandes/interventions, de devis, de factures et d’un index de contrats réellement déposés.

Les invitations sont remises sous forme de codes privés à partager manuellement. Aucun e-mail d’invitation n’est simulé. L’acceptation vérifie l’adresse e-mail de l’identité OAuth, pas une adresse saisie librement. Le propriétaire et les gestionnaires ont des droits de gestion distincts des collaborateurs. Le propriétaire ne peut pas être retiré par la fonction de révocation.

L’appartenance à l’organisation est contrôlée côté serveur pour chaque opération. **Un collaborateur retiré perd aussi l’accès aux demandes qu’il avait créées, à leurs documents et aux notifications.** Un lien de suivi ne contourne jamais les droits d’une organisation. Les autres organisations n’accèdent pas aux données de ce compte.

Les sites peuvent actuellement être ajoutés, consultés et utilisés pour une déclaration. L’édition et la suppression de sites ne sont pas implémentées. Le suivi des contrats est un index documentaire ; les dates, renouvellements, signatures et changements de statut contractuels avancés restent à développer.

### Comptes et évaluations

L’authentification Manus OAuth du starter est réelle, avec validation des sessions, de l’identité de projet et du nonce de connexion. Aucun utilisateur de démonstration ou contournement de connexion n’est utilisé dans la Preview. Les cookies applicatifs sont compatibles avec la Preview HTTPS intégrée ; la session Bearer de la plateforme est prise en charge quand le navigateur bloque les cookies intégrés.

L’environnement ne fournit pas d’identité propriétaire exploitable pour attribuer automatiquement le rôle artisan. Un code privé unique a donc été initialisé. L’utilisateur doit se connecter puis activer son espace artisan avec ce code. Le premier visiteur ne devient jamais administrateur. La base conserve uniquement son hash ; le fichier remis séparément est hors Git et a des permissions locales restreintes. **Le rôle artisan n’a pas été revendiqué pendant les tests.**

Après une intervention réellement terminée, le client et l’artisan peuvent déposer une note et un commentaire facultatif. Les évaluations exigent une identité authentifiée, une autorisation sur le dossier et une intervention avec fin enregistrée. Une seule évaluation par rôle et intervention est autorisée. Les évaluations restent privées, avec état de modération en attente, sans publication automatique.

Une demande individuelle déposée sans compte peut être rattachée ensuite à un compte par une action explicite. Ce rattachement exige à la fois le lien privé exact et une identité OAuth dont l’e-mail correspond au dossier. L’e-mail seul ne suffit jamais. Cela permet au client invité d’accéder ensuite à l’évaluation authentifiée.

### Persistance et pièces jointes

Le modèle relationnel couvre utilisateurs, clients, organisations, collaborateurs, invitations, sites, prestations, tarifs, demandes, événements, interventions, disponibilités, rendez-vous, devis, factures, documents, contrats, notifications, lectures de notification, évaluations, paramètres, journal et versions de seed.

Les deux migrations métier additives ont été appliquées et sont versionnées. Le seed a été exécuté plusieurs fois pour vérifier qu’il ne réécrit pas la configuration existante. La clé de suivi est une clé applicative aléatoire persistée, indépendante de la clé de session de la plateforme ; elle n’est pas exposée par l’API.

Les pièces jointes sont chiffrées individuellement en AES-256-GCM avant transfert vers le stockage objet. Seul le contenu chiffré y est stocké. Les clés et l’index sont conservés côté serveur dans la base. Le téléchargement contrôle les droits avant restitution. Les réponses ne contiennent ni clé, ni IV, ni tag, ni URL de contenu sensible en clair. Formats admis : JPG, PNG, WebP et PDF ; limite de 5 Mo, contrôle du MIME, de la signature et du base64. Les accès API privés sont servis sans cache.

## Éléments simulés ou volontairement absents

Aucune donnée de démonstration n’est présentée comme réelle dans l’application. Les tests emploient une base factice en mémoire et des doubles de stockage, séparés de la base métier ; ce choix ne remplace pas les services réels dans le code livré.

Il n’y a pas d’envoi e-mail/SMS, de notifications push, de planificateur autonome d’expiration sans trafic, de calendrier avancé des disponibilités, de génération comptable des devis/factures, de paiement en ligne, de signature contractuelle, ni d’interface complète de modération/publication des avis. Ces fonctions ne sont pas maquettées comme si elles marchaient. Les écrans concernés exposent leur périmètre réel.

## Contrôles effectués

La dernière suite backend comporte **37 tests réussis dans quatre fichiers**, dont 20 tests des routeurs avec base en mémoire. Elle couvre notamment double confirmation, conflits de planning entre dossiers, indisponibilités, version périmée, expiration persistée, devis distinct, pièces réelles avant facture, justification du paiement, permissions, révocation professionnelle, invitations, activation artisan unique, idempotence du dépôt, rattachement d’une demande invitée, évaluations et chiffrement.

Le contrôle TypeScript et la compilation de production réussissent. Les routes métier sont chargées à la demande pour réduire le JavaScript initial. Les contrôles HTTP réels ont vérifié la santé du serveur, le manifeste des huit routes, le catalogue public vide, les paramètres non inventés, le rejet de la liste artisan sans connexion et les réponses 404 des pages/API inconnues. Le HTML initial de l’accueil, du catalogue informatif et de la confidentialité est disponible sans exécution JavaScript ; les pages privées sont marquées non indexables. Les URL canoniques et métadonnées de partage absolues restent à compléter après choix d’un domaine public réel.

Des captures ont vérifié accueil et catalogue en largeur 1280 px, puis accueil, demande, professionnel et accès artisan en largeur 375 px. Une nouvelle capture mobile de l’accueil a confirmé l’absence de débordement après amélioration des tailles de texte. Les principaux contrastes texte/fond sont supérieurs au seuil AA pour texte normal : bouton orange/blanc 5,00:1 ; texte secondaire/blanc 5,86:1 ; anthracite/blanc 14,55:1. Les labels, focus visibles, zoom autorisé, contrôles larges et navigation clavier/modalités sont présents. Cela vise WCAG 2.2 AA, **sans constituer une certification de conformité**.

Une revue indépendante en lecture seule a identifié un défaut de révocation professionnelle et deux projections erronées du suivi. Ils ont été corrigés ; la révocation est couverte par un test de régression vérifiant liste, détail, action client et téléchargement, sans appel au stockage après refus.

La vérification de la base réelle a constaté 34 prestations de configuration et zéro demande, organisation, rendez-vous ou document métier. Aucun faux client n’a été injecté. Les parcours OAuth complets avec les vrais comptes MDS, l’activation artisan, le dépôt réel en stockage et une recette bout en bout sur des dossiers réels n’ont pas été exécutés : leurs mécanismes sont implémentés et testés par doubles, mais leur recette utilisateur reste nécessaire.

## Points à régler avant ouverture commerciale

MDS doit renseigner identité légale, adresse, immatriculation, contacts, zone, assurances/conditions applicables, tarifs et prestations réellement proposées. Les pages légales signalent les informations manquantes au lieu de les inventer. Il faut également finaliser responsable de traitement, conservation, exercice des droits et suppression physique des fichiers. Les mesures d’audience facultatives du site ont été désactivées ; cela ne signifie pas que toute télémétrie de la plateforme ou du badge a disparu.

Les contrôles de type et de signature des fichiers ne remplacent pas un antivirus. Un transfert de contenu chiffré réussi suivi d’un échec de transaction peut laisser un objet chiffré orphelin ; le nettoyage physique nécessite un mécanisme opérateur à ajouter. La protection anti-abus publique, la supervision, la conservation et une recette de sécurité doivent être renforcées avant diffusion commerciale. Les tests de concurrence utilisent un double transactionnel, pas un essai de charge sur MySQL.

La source et les décisions doivent rester dans ce même projet pour les prompts 2/3 et 3/3. `docs/CONTINUITE.md` précise les invariants et les prolongements. La sauvegarde de version Manus et la publication sont deux actions distinctes ; cette livraison est une fondation fonctionnelle sauvegardée, pas une promesse de mise en service commerciale complète.
