# MULTISERVICES MDS — Fondations, prompt 1/3

## Produit et périmètre
Une application unique pour un seul artisan, sans marketplace ni équipe. Le site public propose une recherche par métier et un parcours de demande progressif sans compte. Toute demande libre est conservée au statut « À analyser ». Le catalogue complet demandé est initialisé comme configuration inactive : aucune offre non validée n’est annoncée comme disponible. Les comptes particuliers, organisations et collaborateurs utilisent des identités authentifiées. L’artisan dispose d’une navigation courte : Aujourd’hui, Demandes, Planning, Devis, Clients, Factures, Paramètres.

Les fondations incluent dépôt et suivi réels de demandes, traitement artisan, catalogue administrable, organisations/sites/collaborateurs, documents et contrats indexés, permissions et journal sensible. Les disponibilités, rendez-vous, interventions et notifications disposent de tables extensibles. Aucun créneau, tarif, facture ou contrat fictif n’est présenté comme réel. Le moteur de réservation/planning et les automatisations seront poursuivis dans le même projet au prompt 2/3 ; les écrans concernés exposent honnêtement cet état. Trois clics seulement lorsque les informations disponibles le permettent : ne pas sacrifier adresse, coordonnées et consentement.

## Stack et infrastructure vérifiées
Le sandbox ne contient aucun projet précédent. Le projet MDS unique a été initialisé avec le starter React 19, TypeScript, Vite, Express, tRPC et Drizzle/MySQL géré par Manus. Serveur et base sont disponibles. Le frontend et l’API sont servis ensemble sur le port 3000, puis via le Dockerfile existant. Authentification Manus OAuth réelle, rôle administrateur limité à l’identité du propriétaire configuré ; pas de connexion de démonstration ni de rôle choisi par le visiteur. Vérification serveur des appartenances aux organisations sur chaque lecture/écriture. Tous les états métier sont en base, pas dans des jeux de données simulés.

Les photos et documents sensibles seront chiffrés avant stockage objet, avec restitution exclusivement via une route autorisée. Les adresses de stockage public ne contiendront que des octets chiffrés. Clés documentaires conservées côté serveur dans la base, jamais dans le navigateur. Les brouillons de formulaire sont conservés seulement dans la session du navigateur et supprimés après succès. Dictée via API vocale du navigateur quand disponible, repli explicite sur saisie écrite. Pas d’envoi email/SMS prétendu : notifications internes uniquement.

## Structure du projet
- `client/src/pages/` : accueil, catalogue, demande progressive, suivi, professionnel, espace artisan et informations de confidentialité.
- `client/src/components/mds/` : identité, navigation, champs accessibles, états vides et composants métier.
- `shared/` : catalogue initial, validations, types et statuts communs, source unique de vérité.
- `server/mds/` : procédures métier, droits, index documents et téléchargement privé.
- `drizzle/schema.ts` et `drizzle/` : modèle relationnel, migrations versionnées.
- `server/_core/` : identité et HTTP du starter, conservés et durcis si nécessaire.
- `docs/` : état du produit, configuration requise et continuité prompt 2/3.

## Direction visuelle
Esthétique d’atelier contemporain : anthracite profond, blanc cassé et orange brûlé, avec une hiérarchie typographique éditoriale sans décoration superflue. Principes : clarté immédiate, proximité artisanale, contrastes forts, densité confortable. L’orange sert l’action et le repérage ; l’anthracite donne une assise professionnelle. Accueil asymétrique : promesse et recherche à gauche, photographie métier à droite, puis rangée compacte des métiers et parcours en trois étapes. Éléments signature : monogramme MDS angulaire évoquant un bâti, petits libellés uppercase espacés, traits orange de repérage.

Interaction : une action principale évidente, retour toujours possible, questions progressives, libellés usuels, erreurs près du champ et états explicites. Pas d’animations décoratives ; respecter `prefers-reduced-motion`. Typographies : Manrope pour titres et marque, Inter pour corps et données, repli système. Marque : « Un interlocuteur pour vos réparations et travaux » ; fiable, concret, accessible. Ton court : « Un problème chez vous ? On commence ici. » et « Décrivez simplement ce qui ne fonctionne pas. » Monogramme MDS en cadre architectural orange ; couleur signature orange brûlé #BC4C23, avec contrastes AA vérifiés sur texte et boutons.

Cible WCAG 2.2 AA : zoom autorisé, labels visibles, focus clavier distinct, boutons au moins 44 px, contraste, erreurs annoncées et structure sémantique. Une certification complète nécessite un audit dédié et n’est pas présumée.

## Limites de mise en service
L’adresse, la zone, les tarifs, les prestations proposées et l’identité légale ne sont pas fournis. Ils restent à configurer, sans invention. Le catalogue est inactif à la livraison. Connexion nécessite un compte Manus ; email/mot de passe métier pourra être discuté si demandé ultérieurement. Les tests d’intégration métier utilisent des mocks de la couche DB pour ne pas injecter de faux clients dans la base partagée. Une validation indépendante en lecture seule complète les diagnostics et tests automatisés.

## Modification approuvée — double validation centrale
L’utilisateur a validé l’approche puis imposé le 5 novembre 2026 un moteur de demande avec validation MDS et confirmation client. La présente version inclut donc : créneau souhaité, acceptation/refus artisan, autre proposition de créneau, demande de précisions, devis distinct, confirmation/refus client, rendez-vous créé uniquement après accord des deux parties, événements réels horodatés, version optimiste/idempotence, notifications internes synchronisées et évaluations bilatérales privées liées à une intervention terminée et à un utilisateur authentifié. Les états incluent Brouillon, Demande envoyée, En attente de MDS, À analyser, Demande acceptée par MDS, Proposition de nouveau créneau, Informations complémentaires demandées, En attente de confirmation client, Confirmée, Refusée, Annulée, Intervention planifiée, Intervention en cours, Intervention terminée, Facture émise, Paiement confirmé, Clôturée. Les changements sont encadrés par une machine d’états ; aucun progrès illustratif n’est affiché comme un événement réel.

Acceptation en un clic disponible quand prix et créneau sont définis. Un devis complexe exige une acceptation de devis distincte avant confirmation. Expiration configurable des propositions, contrôle côté serveur à l’accès/aux actions ; aucune notification email/SMS ou exécution autonome de fond n’est prétendue sans canal configuré. Les fondations planning utilisent les rendez-vous effectivement confirmés. Aucune disponibilité générique fictive. Le calendrier avancé, canaux externes et exécution des expirations sans trafic restent explicitement à poursuivre au prompt 2/3.
