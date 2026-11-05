# PROMPT 2 — Moteur opérationnel et devis

## Périmètre livré

Le moteur existant est conservé. L’accord MDS, l’accord sur le devis et la confirmation du rendez-vous restent distincts. Les réponses `photo` et `diagnostic` demandent des informations précises au statut `needs_information`, sans réservation ni montant inventé. Le départ `depart` exige un rendez-vous confirmé actif ; il enregistre `departedAt` et l’événement `en_route` uniquement après déclaration réelle de l’artisan. Le démarrage accepte les états confirmé, planifié ou en route. L’annulation reste possible en route avant démarrage.

Une proposition conserve son créneau principal dans `proposedStart` et jusqu’à cinq créneaux **supplémentaires** dans `alternatives`. Les doublons et une répétition du créneau principal sont retirés. Chaque alternative reçoit un UUID serveur et passe les mêmes contrôles de date future, prix explicite, durée et calendrier. Aucune proposition ne réserve de rendez-vous. `clientAction.confirm` accepte seulement le créneau principal ou un `alternativeId` connu de la proposition courante ; une date arbitraire fournie au moment de confirmer est rejetée. La confirmation recontrôle `checkCalendar(tx, times, request)` sous le verrou global `principal(tx, true)`, puis crée un unique rendez-vous avec ses marges de déplacement/sécurité et une unique intervention. Une demande de replanification efface les alternatives et requiert un nouvel accord MDS.

`expireRequest(tx, request)` est exporté pour l’automatisation et reste utilisable par les lectures/actions existantes. Il retourne un booléen, vérifie l’expiration et la version, écrit l’historique/audit et modifie l’objet chargé après une mise à jour effectivement réussie. Son appel doit rester dans une transaction avec le verrou de l’artisan unique.

## Incidents et travaux supplémentaires

Le routeur `operationsRouter` propose :

| Procédure | Accès et entrée | Effet |
| --- | --- | --- |
| `report` | Artisan, `incidentSchema` : requestId, version, kind, message | Incident horodaté, événement à l’état actuel, version dossier augmentée |
| `complaint` | Client autorisé, `trackSchema` + version, message | Réclamation client ; l’artisan ne peut pas consentir à sa place |
| `resolve` | Artisan : id, requestVersion, resolution | Résolution réelle auditée, sans saut d’état |
| `proposeExtra` | Artisan, `extraWorkSchema` | Portée, montant TTC, durée, conditions et document facultatif du même dossier ; expiration configurable |
| `respondExtra` | Client autorisé : suivi + id, version du supplément, accept | Accord/refus explicite de cette version et de ce périmètre précis |
| `startExtra` / `completeExtra` | Artisan : id, version du supplément | Déclarations d’exécution réelles, séparées de l’accord |
| `cancelExtra` | Artisan : id, version du supplément | Annulation explicite avant commencement seulement |

Les incidents ouverts `problem`, `client_absent` et `artisan_unavailable` bloquent début/fin de l’intervention et des suppléments jusqu’à résolution. `no_slot`, `payment_failed` et `complaint` restent informatifs : ils n’inventent pas de progression et ne bloquent pas automatiquement les travaux. Toute résolution ajoute un nouvel événement et une nouvelle version du dossier, sans démarrage automatique.

Un supplément ne modifie jamais le prix principal. Son document doit appartenir au même dossier. Le total d’exposition est borné côté serveur. Une proposition expirée est enregistrée comme refus sans accord ; le conflit API est retourné **après commit** de cet événement. L’artisan ne peut pas enregistrer l’accord client. Le démarrage d’un supplément exige son acceptation, une intervention principale réellement commencée et l’absence d’incident bloquant. Aucune exception juridique automatique ne contourne le consentement.

La fin principale bloque tant qu’un supplément reste en attente, accepté mais non commencé, ou en cours. Les travaux non exécutés doivent être explicitement refusés/annulés. La facture conserve `requireContractPrice(request, request.proposedPriceCents)` pour le prix de base puis ajoute uniquement les suppléments terminés ayant une preuve d’accord, de début et de fin. Les travaux non réalisés ne sont jamais facturés.

Le paiement manuel vérifie ce montant agrégé. Il refuse les sessions Stripe live encore réutilisables (`pending`/`failed`) sur le dossier et les succès live non rapprochés. Il utilise `commercialPaidCents(tx, requestId)` pour déduire les fonds commerciaux réellement crédités et les remboursements réussis, sans compter les tests. Seul le solde restant est ajouté au registre manuel, avec `receivedAmountCents`, `confirmedAt` et `creditedAt`. La note de vérification réelle reste obligatoire. Aucun encaissement n’est exécuté par cette déclaration.

## Devis structurés et PDF

`quoteBuilderRouter.list({requestId})`, `save({requestId,requestVersion,id?,version?,content})` et `generate({id,version})` sont réservés à l’artisan. Les écritures recontrôlent l’autorisation dans la transaction verrouillée, l’état négociable, le rattachement et les versions. Un brouillon peut être préparé **sans créneau d’intervention**. Les identités et coordonnées, l’immatriculation, les lignes HT, TVA en points de base, inclusions/exclusions, conditions, validité, modalités de paiement, acompte et assurance sont renseignés explicitement. Aucune identité légale, mention fiscale ou assurance n’est préremplie artificiellement.

Les totaux sont calculés sur le serveur ; l’acompte ne peut dépasser le total. Les dates civiles impossibles/expirées sont rejetées ; la validité expire en fin de journée de Paris, changement d’heure compris. La référence UUID et la date de création sont produites côté serveur.

`renderQuotePdf` produit un vrai PDF via PDFKit, avec polices standard Helvetica/Helvetica-Bold intégrées au fonctionnement de PDFKit, sans dépendance à `/usr/share/fonts`. Le document est paginé et numéroté ; longues lignes/conditions sont conservées sur plusieurs pages. Il indique « DEVIS », les données déclarées et les montants calculés, sans prétendre certifier juridiquement les informations fournies.

La génération chiffre les octets en AES-256-GCM via `encryptFile`, transfère uniquement le chiffré à `storagePut` et indexe un document `quote`. Aucune clé ni URL de stockage brute n’est retournée. Le téléchargement réutilise la procédure privée autorisée existante. Un devis généré devient immuable ; sa modification crée une nouvelle copie plutôt que réécrire un PDF existant. Le parent masque les PDF générés non émis aux clients dans le détail et le téléchargement.

L’émission utilise l’action artisan `quote` existante : elle exige encore un créneau défini et un accord client ultérieur distinct. Pour un PDF généré, le prix saisi doit correspondre exactement au total du brouillon lié au dernier document, et sa validité doit être future. Le moteur copie le contenu, le montant et la date d’émission dans le devis courant, puis marque le brouillon `issued`. La proposition expire au plus tard à la fin de validité du devis. L’acompte indiqué n’active ni paiement ni échéancier automatiquement ; l’accord de paiement demeure distinct. Les vrais PDF téléversés historiques restent utilisables, avec contenu structuré nul et responsabilité de l’émetteur quant à leur cohérence.

## UX artisan

L’interface affiche trois réponses courantes : **Accepter**, **Refuser**, **Autre créneau**. Photo en un clic, précisions, diagnostic et dépôt d’un devis sont dans « Autres outils ». Les outils incidents/suppléments et préparation du devis sont repliés, sauf incident ouvert ou supplément accepté/en cours à traiter. Le devis s’édite en trois étapes compactes, sans prix ou régime légal par défaut. Les formulaires restent ouverts avec leurs saisies en cas d’erreur ; la version serveur est relue après un conflit.

L’intervention n’affiche qu’une action principale réelle selon son état : déclarer le départ, commencer sur place, terminer. Le départ utilise une confirmation explicite. Un démarrage sur place sans départ déclaré reste disponible comme outil secondaire ; aucun état « en route » n’est alors inventé. Les créneaux alternatifs sont ajoutés manuellement, sans suggestion fictive.

## Vérification et reprise

Les tests utilisent uniquement la base mémoire de test existante, sans sa modification et sans faux clients en base partagée. Les mocks de stockage reçoivent seulement le chiffré. Aucun message externe, paiement, remboursement ou génération documentaire commerciale n’a été lancé.

Vérification du 5 novembre 2026 : `operations.test.ts` (23 tests) et `quote.test.ts` (11 tests), soit 34 tests nouveaux réussis ; régressions moteur/router/tarifs/workflow avec ces nouveaux tests : 119 tests réussis. `pnpm check` réussi après intégration des routeurs parent. Les nouveaux tests couvrent réponses photo/diagnostic, départ/cancellation en route, UUID alternatifs, recontrôle calendrier/double confirmation, expiration, blocage/résolution, réclamation autorisée, accord/refus/expiration/exécution des suppléments, fin bloquée et facture consentie, acompte net réel/remboursement/tests exclus, droits/versions des brouillons, calculs et dates exacts, PDF chiffré multipage, immutabilité et cohérence du montant émis.

Le module ne certifie pas le contenu d’un PDF téléversé, la validité juridique d’un régime fiscal ou une assurance déclarée. La revue de ces informations et les validations commerciales demeurent à l’émetteur. La suite PROMPT 3 peut exploiter les audits, incidents résolus, devis émis et accords précis pour la gestion professionnelle et les contrats, sans contourner les validations présentes.

### Validation intégrée finale

Après intégration des modules parent/calendrier/paiements, `pnpm test` a réussi sur 11 fichiers et **242 tests** le 5 novembre 2026. Le dernier `pnpm check` a également réussi sans erreur. L’import du helper `operationPrincipal` dans `quote-builder.ts` est corrigé. Aucune modification n’a été effectuée sur les fichiers attribués aux autres agents.
