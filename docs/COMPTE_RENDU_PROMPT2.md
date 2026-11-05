# MULTISERVICES MDS — Compte rendu du PROMPT 2/3

Le moteur opérationnel et la refonte de simplicité ont été développés dans l’application existante, avec les mêmes utilisateurs, la même base relationnelle et les mêmes composants. Aucune nouvelle application, aucun faux client et aucune offre commerciale fictive n’ont été créés. La version est disponible dans la Preview ; aucune publication n’a été lancée.

## Simplicité réellement appliquée

L’accueil affiche le logo MDS, « Un problème chez vous ? On s’en occupe. », une description, cinq métiers et la demande libre. La photographie décorative, les explications répétitives et les anciennes rubriques principales supplémentaires ont été retirées.

Le parcours courant est regroupé en trois actions : Besoin, Adresse et créneau, Envoyer. Une description saisie sur l’accueil est reprise directement à l’étape suivante. Le brouillon reste dans la session du navigateur ; le site et le contact professionnel connus sont préremplis. Les questions facultatives ne bloquent pas l’envoi et aucun compte n’est imposé au particulier. Trois actions ne signifie pas que toutes les coordonnées inconnues ou les consentements financiers peuvent être supprimés : ils sont recueillis au moment utile.

L’artisan a trois rubriques principales : Demandes, Planning, Interventions. Les trois réponses principales restent Accepter, Refuser, Autre créneau. Photo, précision, diagnostic, devis, paramètres, échéancier et remboursement sont accessibles par contexte et généralement repliés. Le professionnel a Déclarer, Suivre, Bâtiments, avec ses contacts, membres et documents derrière les actions utiles plutôt que de nouveaux menus.

## Demandes et suivi

Une demande ne réserve jamais un rendez-vous. L’artisan propose un prix, une durée et un créneau ; le client confirme les conditions requises. Pour le mode devis, l’acceptation du devis demeure distincte de la confirmation du rendez-vous. Jusqu’à cinq alternatives supplémentaires peuvent être proposées avec des identifiants créés par le serveur. Leur sélection est recontrôlée au moment de la confirmation transactionnelle.

La chronologie enregistre les événements réels et leurs dates. « Artisan en route » apparaît uniquement après déclaration du départ. Début, fin, facture, paiement et clôture reposent sur des actions ou preuves réellement enregistrées. L’adresse, les coordonnées, les photos, les documents et les conditions acceptées restent dans le même dossier. Le suivi fonctionne au moyen d’un lien privé ; l’accès à une organisation exige toujours une appartenance actuelle autorisée.

## Calendrier

Le calendrier central intègre les horaires hebdomadaires, les plages disponibles exceptionnelles, les congés/blocages, la durée, les zones par préfixe postal, le déplacement et une marge de sécurité. Les heures sont contrôlées selon Europe/Paris, y compris les ambiguïtés et changements d’heure. Les occupations déjà confirmées conservent leurs marges. Le serveur vérifie les conflits sous verrou transactionnel avant d’insérer un rendez-vous unique ; une consultation de disponibilité ou une proposition ne réserve rien.

Les horaires ne sont pas inventés. Le calendrier reste désactivé tant que MDS n’a pas validé ses paramètres. Les trajets sont des durées configurées, pas une mesure du trafic routier en temps réel. Les périodes bloquées ne peuvent pas supprimer silencieusement une occupation confirmée.

## Prix, devis et travaux supplémentaires

Les deux modes restent appliqués : prix fixe calculé depuis les règles MDS, ou devis personnalisé. Le prix de base, le déplacement applicable, les inclusions, les exclusions et les conditions sont conservés au dépôt. Un changement de catalogue ne réécrit pas les dossiers existants.

L’éditeur de devis produit un brouillon structuré, des montants calculés en centimes côté serveur et un véritable PDF privé chiffré. Il recueille les informations de l’émetteur et du client, la référence, les dates, les lignes, taxes, validité et conditions/paiement. Les informations juridiques ne sont pas inventées. Un PDF généré est immuable ; une révision passe par copie. L’émission exige le montant exact du document et sa validité future. Les brouillons non transmis sont cachés aux clients, y compris leurs métadonnées dans l’espace professionnel. Cela ne constitue pas une certification juridique du devis.

Un supplément précise son périmètre, prix, durée et conditions. Le client doit l’accepter avant tout démarrage, lequel doit encore être déclaré par MDS. Les suppléments en attente ou en cours empêchent la fin principale ; la facture ajoute uniquement les suppléments acceptés et réellement terminés. Aucune exception juridique automatique n’autorise du travail sans consentement.

## Incidents et reprise

Refus, expiration, absence de créneau, annulation, absence client, indisponibilité artisan, paiement échoué, devis refusé et réclamation restent enregistrés et horodatés. Un incident bloquant doit être résolu explicitement avant démarrage/fin ; sa résolution ne fait pas sauter automatiquement des étapes. Une réclamation est enregistrable depuis le suivi privé. Les versions périmées sont rejetées. Un formulaire artisan réactualisé doit relire son contexte au lieu de soumettre silencieusement d’anciens champs avec une nouvelle version.

## Qualification IA

L’aide facultative en langage naturel est réellement reliée au service de modèles intégré. Elle peut proposer un métier et, lorsqu’une offre active correspond, une prestation. Une seule question utile est affichée à la fois. Le résultat n’active aucune prestation, ne pose aucun diagnostic, n’invente pas de prix et ne confirme rien.

L’appel exige un accord, transmet la description et les réponses utiles mais pas les champs structurés de contact/adresse, borne le délai et le nombre d’appels, puis valide le résultat. En cas d’erreur ou d’incertitude, la demande libre reste disponible pour MDS. Les utilisateurs sont informés d’éviter d’écrire des coordonnées dans la description.

Deux contrôles réseau ont été effectués avec une description synthétique du robinet qui fuit, sans enregistrement de dossier. Le helper réel puis l’API tRPC avec le format structuré de production ont répondu. Le second contrôle a retourné HTTP 200, métier probable plomberie, une question et serviceId nul, cohérent avec le catalogue réel encore inactif.

## Paiements

L’intégration Stripe est réelle mais demeure en mode test. Elle gère paiement intégral, échéancier d’acompte accepté par le client, acompte avant facture, solde calculé par le serveur, liens Checkout, historique, échecs et remboursements. Une réponse de navigation ne prouve jamais un succès.

Les fonds reçus prouvés, montants réservés et crédits commerciaux sont distincts. Un paiement de test ne réduit pas la dette réelle et n’acquitte aucune facture. Les règlements manuels ne portent que sur le solde exact vérifié ; les sessions live encore réutilisables empêchent un double encaissement.

Le remboursement exige la référence, le mode, le montant, le motif et une confirmation explicite. La réservation et sa clé sont enregistrées avant l’appel Stripe, puis le résultat est relu auprès du prestataire. Pending n’est jamais un remboursement réussi. Un remboursement commercial confirmé peut réouvrir financièrement une facture sans inventer une nouvelle intervention. Aucun portefeuille interne ni donnée de carte n’est conservé.

Les nouveaux parcours de paiements et remboursements ont été testés avec SDK simulé en mémoire, pas avec un encaissement bancaire ou un remboursement réel. Aucune création Stripe externe, même de test, n’a été lancée pendant ce PROMPT 2. La recette bancaire de bout en bout et la mise en service live restent à effectuer par le propriétaire.

## Notifications et automatisation

Les notifications internes sont transactionnelles. Une file externe durable et dédupliquée est préparée pour Resend et Twilio, sous réserve du choix et des paramètres du propriétaire. Les canaux sans clés et expéditeurs autorisés restent désactivés. Aucun e-mail ou SMS réel n’a été envoyé pendant les tests.

Le registre différencie à envoyer, traitement en cours, accepté par le fournisseur, livré avec preuve, échec et résultat incertain. Les reprises sont bornées ; un envoi potentiellement réussi n’est pas relancé aveuglément. Les workers conditionnent leurs écritures au claim/tentative courant, y compris lors d’un changement de configuration. La relecture fournisseur vérifie l’identifiant et le destinataire avant d’enregistrer une livraison. Les messages et les liens privés ne sont pas exposés dans une liste publique.

Le callback natif d’expiration/rappels est développé avec vérification JWT, projet, expiration et taskUid résolu par OAuth. Il traite les expirations sans visite client, prépare les rappels et traite la file avec registres dédupliqués. Un traitement manuel confirmé est disponible pour reprise. Cependant, sans publication et sans enregistrement d’une tâche native active, le traitement autonome n’est pas activé : aucun timer local du sandbox n’est présenté comme une automatisation durable. La procédure se trouve dans `docs/ACTIVATION_PROMPT2.md`.

## Contrôles réalisés et problèmes corrigés

`pnpm check` est propre. La dernière exécution comporte **255 tests réussis dans 12 fichiers**, couvrant les deux modes tarifaires, accords/refus, alternatives, expiration, annulation, fin d’intervention, permission/révocation d’organisation, calendrier/concurrence, suppléments, PDF, échéances/remboursements, qualification, file externe et identité des callbacks. Les tests métier utilisent une base en mémoire et des fournisseurs simulés ; ils ne remplacent pas une recette avec les comptes réels.

Le build de production est réussi, avec contenu HTML initial public. Un import CSS incompatible avec le pré-rendu a été déplacé au point d’entrée client. Un avertissement non bloquant de Vite subsiste sur la taille du bundle initial ; les espaces et outils métier sont déjà chargés à la demande.

La revue indépendante en lecture seule a identifié trois défauts, corrigés avant remise : course de worker pouvant réarmer un envoi, métadonnées de devis brouillon visibles au professionnel et rebasage implicite d’un formulaire artisan périmé. Des régressions ciblées ont été ajoutées et passent. Le double SQL de test a été complété pour reproduire les jointures réellement utilisées par le détail d’organisation.

Les captures à 390 pixels et 1280 pixels ont contrôlé accueil, demande et catalogue, ainsi que les entrées publiques du suivi et des espaces protégés. Les écrans privés authentifiés ont été vérifiés par source/types/permissions, pas par une connexion utilisateur simulée. Le contraste de l’étape courante a été corrigé après observation. Le parcours WCAG est une cible prise en compte, pas une conformité certifiée.

Les contrôles HTTP ont établi : health 200, manifeste des neuf pages en JSON 200, route absente 404, pages privées sans cache, callback natif sans identité 401 et webhook Stripe non signé 400. La base partagée inspectée contient un utilisateur existant et zéro client, demande, rendez-vous, facture, paiement, remboursement, message externe ou tâche autonome. Aucun faux dossier n’a été conservé.

## Ce qui reste avant ouverture et PROMPT 3/3

L’artisan doit activer son rôle avec son code privé, valider ses prestations, renseigner les paramètres réels du calendrier et ses informations légales. Le propriétaire doit choisir/configurer les fournisseurs externes, autoriser la publication puis vérifier une première exécution native et des livraisons réelles avec des destinataires choisis. Stripe doit être configuré pour l’entreprise avant tout encaissement live.

Le PROMPT 3/3 doit poursuivre ce même projet pour la gestion professionnelle avancée, les cycles de contrats, l’administration et l’audit final. Les règles de conservation/suppression physique, la modération, la recette réelle OAuth/métier et l’audit juridique/accessibilité restent explicites. Il ne faut pas recréer une application ni réintroduire une multitude de menus.
