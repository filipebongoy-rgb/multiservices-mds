# MULTISERVICES MDS — Tarification backend hybride

État vérifié le 5 novembre 2026 dans le projet existant `/home/ubuntu/mdsservices`. Aucun nouveau projet, seed, compte activé, dossier client fictif, débit Stripe, commit, push ou publication n’a été lancé par cette intervention.

## API exacte

```ts
mds.catalog.pricing.query({
  serviceId: number | null,
  postcode?: string, // exactement cinq chiffres lorsqu’il est fourni
}): Promise<{
  snapshot: PricingSnapshot,
  fingerprint: string, // 64 caractères hexadécimaux SHA-256
}>
```

La procédure est publique. Pour un service sélectionné, elle résout une ligne réelle `mds_services` active et non supprimée ; sinon elle échoue avec `NOT_FOUND`, sans présenter une offre indisponible. Pour `serviceId: null`, elle utilise `calculatePricing(null, postcode)`. Le calcul provient exclusivement de `shared/pricing.ts` ; le backend ne fixe aucun prix lui-même. L’empreinte est exactement `hash(JSON.stringify(snapshot))`.

Le snapshot conserve mode, règles, inclusions, exclusions, conditions, zone, durée, règles de déplacement, service, révision, code postal, base/déplacement/total calculés, nécessité de devis et raison. En mode `quote`, les montants calculés `baseCents`, `travelCents`, `totalCents` restent `null`, même si l’administrateur possède encore un ancien `priceCents` en base. Ce prix de configuration historique reste une métadonnée du contrat `PricingRules` partagé, pas une offre ni un prix contractuel. L’interface doit afficher le total uniquement lorsque `requiresQuote` est faux ; elle ne doit jamais promouvoir `snapshot.priceCents` en prix ferme en mode devis. Si le parent souhaite également masquer cette métadonnée dans la réponse API quote, le changement doit se faire dans `shared/pricing.ts`, sans effacer le prix réel en base ; ce fichier n’a pas été modifié ici.

Les frais fixes proviennent du montant admin ; les frais par code postal utilisent le préfixe correspondant le plus spécifique. Un code non couvert ou une configuration de déplacement non validée nécessite un devis et ne produit pas de total incertain.

`catalog.list` et `catalog.save` normalisent seulement leur vue publique : `included/excluded: null` deviennent `""`, et `travelRules: null` devient `[]`. La lecture ne réécrit pas la base. `seedKey` et `deletedAt` restent absents de cette vue.

## Administration et historique

`catalog.save` utilise le nouveau `serviceSchema`. L’activation d’un prix affiché exige notamment prix explicite, inclusions, exclusions, conditions, zone, description, durée valide et déplacement configuré. Une condition constituée seulement d’espaces est aussi refusée côté backend ; aligner éventuellement `.trim()`/la refinement de `conditions` dans le schéma partagé côté parent pour que la validation UI soit identique. Aucune modification de `shared/*` ou `drizzle/schema.ts` n’a été réalisée par cet agent.

Chaque changement de la configuration tarifaire complète incrémente `pricingVersion` : mode, base, règle, inclusions, exclusions, conditions, durée, zone, mode/frais/règles de déplacement. Une simple description ou un enregistrement inchangé ne révise pas le tarif. La première configuration d’un service créé reçoit la version 1.

`mds_tariffs.configuration` contient exactement les champs `PricingRules`, sans mélange avec des métadonnées du service. Une révision ferme tous les tarifs ouverts du service via `validUntil` et ouvre le nouveau tarif avec le même instant `validFrom`. Les modifications du catalogue ne changent ni snapshot, ni durée, ni montant des demandes existantes. Passer sur devis ne détruit pas les anciennes valeurs de base ou de déplacement.

## Dépôt et contrat immutable

Pour une nouvelle demande avec prestation sélectionnée, `requests.create` exige `pricingFingerprint` égal à l’empreinte du recalcul serveur avec le code postal final. L’absence, un changement de règle ou une mauvaise empreinte provoque `CONFLICT` demandant de relire prix et conditions, avant insertion de tout client/dossier/événement.

La recherche d’un dépôt idempotent déjà existant précède le recalcul et la validation temporelle du nouveau dépôt. Un retry identique réussit donc même si le tarif a changé, si le service est désactivé ou si le créneau souhaité initial est désormais passé. Le payload hash inclut l’empreinte ; réutiliser la même clé avec une autre empreinte est un conflit. Les droits d’organisation sont toujours vérifiés en direct, y compris lors d’un retry.

`pricingFingerprint`, `consent`, `desiredStart` brut et `idempotencyKey` sont retirés du spread SQL. Le snapshot calculé est enregistré une seule fois dans `requests.pricingSnapshot`, y compris pour une demande libre. Le prix proposé initial est `snapshot.totalCents` et la durée initiale est celle du snapshot ; en mode devis le prix proposé reste `null`.

Les nouvelles demandes nécessitant un devis ne peuvent pas contourner ce devis via `accept`, `propose` ou `confirm`, même si un montant est envoyé à l’API. Elles exigent un vrai document de devis proposé, puis son acceptation distincte par le client. La confirmation du créneau demeure une action séparée.

Un forfait à total connu interdit toute acceptation/proposition avec un prix différent du snapshot. Un nouveau périmètre/prix passe par l’action `quote` et un nouveau vrai document. Un devis accepté fige le prix actuellement proposé ; il ne peut pas être altéré par acceptation/proposition. Le snapshot d’origine reste inchangé même lorsqu’un devis réel remplace le forfait.

Les demandes historiques avec snapshot `null` conservent leur ancien flux. Un montant réel explicite demeure exigé avant tout accord ; aucune rétroactivité ni estimation n’est inventée.

## Facturation et vérification manuelle

L’action `invoice`, réservée à un dossier réellement terminé avec vrai document facture, insère `amountCents = request.proposedPriceCents` et `currency = "EUR"`. Un prix transmis dans l’action facture n’est pas utilisé pour changer le contrat. Un montant contractuel absent/invalide ou incompatible avec le snapshot est rejeté.

L’action artisan `paid` vérifie dans une transaction : état `invoiced`, vraie facture, montant entier valide, devise EUR, montant identique au contrat, facture non réglée, motif réel de vérification, et absence de paiement Stripe `live/pending` pour cette facture. Le verrou global du principal est partagé avec la réservation Checkout de l’autre agent. Une session live encore en attente doit être vérifiée/expirée avant un paiement manuel, même si son état local est ancien. Un paiement test pending ou un live expiré ne bloque pas cette vérification hors ligne.

Elle met ensuite à jour `invoices.paidAt/paymentVerifiedBy/verificationNote` et insère un paiement `provider="manual"`, `mode="offline"`, `status="succeeded"`, au montant/devise exacts de la facture, avec `verifiedBy`, `verificationNote` et `confirmedAt`. Le statut dossier et l’événement sont enregistrés dans la même transaction. Il ne s’agit ni d’un encaissement carte ni d’un appel bancaire. Les anciennes factures sans montant ne sont pas remplies arbitrairement et exigent une nouvelle validation métier.

Le routeur `paymentsRouter` produit par l’autre agent est raccordé sous `mds.payments` dans `server/mds/router.ts`, à la demande du parent. Ni `payments.ts`, ni `payment-webhook.ts`, ni `server/_core/index.ts` n’ont été modifiés par cet agent. La mise à disposition et la vérification du webhook HTTP restent à l’agent paiement/au parent.

## Migration réellement appliquée

1. `pnpm exec drizzle-kit generate` a produit `drizzle/0003_colossal_power_man.sql` et sa métadonnée `drizzle/meta/0003_snapshot.json`/journal.
2. La migration a été lue avant son application. Elle ajoute les deux tables paiement/événements, leurs contraintes/index, le montant/devise facture, le snapshot demande, les champs tarifaires service et la configuration historique des tarifs. Aucune suppression, drop, truncate, reset ou seed n’est présent.
3. L’ajout a été complété explicitement par :

```sql
UPDATE `mds_services`
SET `pricingMode` = 'fixed'
WHERE `priceCents` IS NOT NULL;
```

Cette migration conserve le sens des prix legacy configurés, tout en laissant le défaut des nouvelles prestations sur devis. Elle ne crée aucun montant, frais, inclusion ou activation.

4. `pnpm db:migrate` a réellement réussi. L’historique SQL contient le hash `7f408db453d29f37373c6e02080492d78948f28bdd3e1ae6faba4c1d8603fb75` de cette migration.
5. Une comparaison avant/après des volumes et hashes des anciennes colonnes de chaque table MDS et `users` confirme la conservation de toutes les anciennes lignes et de tous les champs originaux examinés. La base comptait et compte toujours 34 prestations inactives, 1 paramétrage, 1 version de seed, 1 utilisateur ; zéro client, demande, facture, paiement ou événement paiement. Les 34 prestations existantes sans prix restent en mode devis. Aucun document/client/dossier test n’a été injecté.
6. Une nouvelle exécution de `pnpm exec drizzle-kit generate` indique « No schema changes, nothing to migrate ».

Les données disponibles ne comportaient aucun ancien prix renseigné ; le `UPDATE` de préservation est bien appliqué et présent dans la migration, mais son cas avec ancien prix renseigné n’a pas été testé par écriture sur cette base partagée. Le changement de mode avec vrai montant conservé est couvert exclusivement dans les tests en mémoire.

## Vérifications et fichiers

Au contrôle du 5 novembre à 11:21 CET : `pnpm check` réussi ; `pnpm test` réussi, 6 fichiers et 123 tests au total, dont 53 tests `tariffs.test.ts`, 20 tests routeur et 11 tests workflow. La suite paiement de l’autre agent comptait alors 33 tests. `git diff --check` réussi. Les suites sont des doubles DB/environnement, pas des encaissements ni des créations de dossiers dans la base partagée.

Les nouvelles régressions couvrent calcul admin fixe/postal, exactitude API/empreinte, champs nullable, devis sans total ferme, refus de prestations inactives/supprimées, dépôt avec règle changée sans client parasite, retry idempotent après modification/désactivation/temps écoulé, immutable après changement catalogue, version/historique de tous les champs tarifaires, validation d’activation, impossibilité de sauter le vrai devis, supplément nécessitant nouveau devis, prix de devis accepté invariant, ancien flux snapshot null, facture au vrai prix et registre manuel, anciennes factures invalides rejetées, et conflit avec Stripe live pending.

Fichiers écrits/modifiés dans le périmètre : `server/mds/requests.ts`, imports/section catalogue/raccordement payments de `server/mds/router.ts`, `server/mds/tariffs.ts`, `server/mds/tariffs.test.ts`, fixture legacy de `server/mds/router.test.ts`, `server/mds/test-db.ts`, `drizzle/0003_colossal_power_man.sql`, métadonnées/journal de migration et ce document. Le double de tests applique les defaults littéraux/nullable issus du schéma réel et rejette un champ SQL inexistant à l’insertion, afin de détecter un passage accidentel de l’empreinte au SQL plutôt que masquer le défaut.

Limites restantes : recettes avec vraies identités MDS/dossiers, contrôle indépendant du contenu des documents devis/facture par l’artisan, validation propriétaire de ses offres/règles/zone et coordonnées, webhook et configuration commerciales, traitement opérationnel des anciennes factures sans montant, automatisations autonomes du prompt suivant. Le backend vérifie l’existence et la liaison du vrai document de devis/facture ; il ne prétend pas OCRiser ou vérifier juridiquement que son contenu reproduit le montant saisi. Aucun état de paiement ne doit être inféré d’un simple retour navigateur.
