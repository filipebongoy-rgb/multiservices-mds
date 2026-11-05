# PROMPT 2 — Paiements, échéances et remboursements

## Livraison et branchements

Le module existant `paymentsRouter` conserve `config`, `list`, `mine` et le résultat Checkout `{ url, mode }`. Il embarque directement les procédures de `payment-stages.ts` et `refunds.ts` : aucune branche supplémentaire du routeur racine n’est nécessaire. Le webhook reste enregistré avant les parseurs Express sur `/api/stripe/webhook`.

```ts
import { commercialPaidCents } from "./payments";
// Signature exacte, utilisable avec une transaction Drizzle :
commercialPaidCents(tx: SqlDb, requestId: number): Promise<number>
```

Cette fonction compte seulement les lignes `succeeded`, EUR, mode `live`/`offline`, avec `confirmedAt`, `creditedAt` et un `receivedAmountCents` entier prouvé. Elle déduit les remboursements live `succeeded`, EUR, confirmés, pour le même versement. Les tests, fonds retenus pour rapprochement, réservations et remboursements pending/failed/cancelled ne créent pas de crédit commercial. Le résultat ne descend jamais sous zéro par versement. **Aucun reçu ou crédit historique n’est reconstitué depuis `amountCents`, `paidAt` ou un commentaire libre.** Les anciennes factures déjà acquittées restent acquittées et bloquent un nouveau Checkout ; leur rapprochement historique est une action explicite séparée, pas un backfill inventé.

Le moteur émet sa facture au total contractuel accepté augmenté seulement des suppléments acceptés et terminés. Une vérification manuelle doit réserver le **restant** `invoice.amountCents - await commercialPaidCents(tx, requestId)` et persister séparément `receivedAmountCents`, `confirmedAt`, `creditedAt`, `verifiedBy`. Elle doit refuser un paiement Stripe live pending/failed sur **tout le dossier**, même si la tentative d’acompte n’a pas encore de facture. Une modification de devis/prix après réservation ou acompte réel exige gel/annulation explicite de l’ancien échéancier et rapprochement ; les fonds ne doivent pas être silencieusement déplacés sur un nouveau prix.

## Échéanciers et Checkout

| Procédure | Accès et contrat |
| --- | --- |
| `plan({reference, token?})` | Autorisation du dossier identique au suivi, appartenance organisation actuelle prioritaire. Renvoie `activePlan`, `totalCents`, `totalPaidCents`, `remainingCents`, `depositCents`, `invoice`, `invoicePayable`, `withheldLive`, `pendingLive`, `successfulTestPurposes`, `testReceivedCents`, `refunds` publics sans motif ni IDs Stripe. |
| `proposePlan({requestId, version, depositCents, conditions})` | Artisan propriétaire uniquement. Aucun total envoyé par le navigateur. Total calculé depuis le prix fixe figé approuvé par MDS ou un devis réellement accepté et les suppléments acceptés terminés. Remplace une proposition précédente seulement sans fonds/réservation commerciale active. Incrémente la version du dossier, mais pas son prix/statut. |
| `respondPlan({reference, token?, id, version, accept})` | Client autorisé uniquement ; l’artisan propriétaire est explicitement interdit. Exige le plan actuel proposé et son contrat inchangé. Conserve montant, conditions, version et consentement dans l’événement. N’accepte ni devis, ni rendez-vous, et ne modifie pas le prix. |
| `checkout({reference, token?, origin, purpose?})` | `purpose` vaut `full` par défaut, ou `deposit`/`balance`. Aucun montant client. Retour inchangé `{url, mode}`. |

L’acompte exige un échéancier actuel **accepté**, un contrat réel approuvé non expiré et un montant positif d’au moins 50 centimes exactement égal à l’étape. Il peut être réservé avant facture (`invoiceId = null`), avec `planId` stable. Son succès live impute un crédit et un événement « acompte reçu » au statut actuel ; il ne passe jamais le dossier à `paid` et ne confirme pas le rendez-vous. Une facture émise après la réservation de cet acompte n’invalide pas à elle seule sa preuve.

`full` et `balance` exigent une facture émise EUR et le montant serveur restant. Les dossiers modernes recontrôlent la facture contre le contrat accepté et les suppléments terminés. Les anciennes factures existantes conservent leur voie intégrale liée à la facture. Une seule réservation Stripe pending/failed par dossier et mode peut être réutilisée ; une autre étape ne crée pas une deuxième session concurrente. Une création ambiguë conserve la clé et les paramètres originaux. Une session fournisseur explicitement expirée permet une nouvelle réservation ; un timeout ancien ne renouvelle jamais aveuglément la clé.

Un succès test conserve seulement le registre de test. Il ne réduit pas le solde réel, ne renseigne pas `creditedAt`, n’acquitte pas la facture et ne bloque pas un règlement live ultérieur. Un paiement live reçu mais non conforme bloque un second débit jusqu’au rapprochement.

## Preuve d’argent et exposition publique

`amountCents` est le montant **réservé/contractuel**, jamais une preuve de la somme reçue. `receivedAmountCents` est renseigné par preuve fournisseur EUR entière non négative. Une devise incompatible ou une preuve malformée laisse ce champ nul plutôt que d’afficher un faux reçu en euros. Un écart EUR (par exemple 150 € reçus pour 100 € réservés) garde son montant réel, mais laisse `creditedAt` nul. Le commentaire privé n’est pas utilisé comme preuve.

`creditedAt` est renseigné seulement pour un succès live conforme à l’étape et au contexte commercial sous verrou transactionnel. Le solde/intégral exact acquitte la facture et passe le dossier à `paid` uniquement lorsque le registre couvre la facture. L’historique public ajoute `purpose`, `planId`, `receivedAmountCents`, `creditedAt` aux champs sûrs préexistants. Il n’expose ni identifiant provider, ni clé d’idempotence, ni commentaire de vérification.

Les six types souscrits par la plateforme demeurent ceux documentés dans le guide Stripe : les trois événements payment/Checkout et les trois événements d’abonnement accusés réception sans fonctionnalité commerciale d’abonnement. **Aucun webhook de remboursement n’est disponible dans cet abonnement, ni annoncé comme livré.**

## Remboursements : propriétaire et preuves SDK

| Procédure | Contrat |
| --- | --- |
| `refundable({paymentId})` | Artisan propriétaire ; relit le PaymentIntent exact et la liste des remboursements par SDK. Expose mode, référence, montant réellement reçu, montant réservé, `remainingRefundableCents`, `hasPending` et historique sûr. Lecture fournisseur sans dépense. |
| `refund({paymentId, amountCents, mode, reference, reason, confirm:true, idempotencyKey})` | Artisan propriétaire ; confirmation exacte du mode, de la référence, du montant et du motif, avec checkbox UI et booléen serveur obligatoires. Crée une réservation DB sous verrou **avant** l’appel SDK. |
| `syncRefund({id})` | Artisan propriétaire ; uniquement relecture du remboursement et du PaymentIntent via SDK, sans création/dépense. |
| `refundHistory({requestId})` | Artisan propriétaire ; historique DB du dossier, sans requête de création fournisseur. |

Le plafond est le minimum de deux disponibilités indépendantes : somme réellement reçue moins réservations/remboursements DB, et disponibilité fournisseur après remboursements pending/succeeded. Il ne se base jamais sur le montant de facture réservé. Une liste fournisseur paginée au-delà de 100 entrées est volontairement bloquée pour rapprochement plutôt que de sous-estimer les remboursements existants.

Un timeout conserve la réservation et sa clé ; une confirmation différente reste bloquée tant que l’opération est pending. La même confirmation peut reprendre avec exactement ses paramètres et sa clé avant 23 heures. Au-delà, la conservation d’idempotence fournisseur n’est pas présumée : rapprochement Dashboard obligatoire. Si l’ID fournisseur est connu, `syncRefund` relit sans création. Une réponse `refunds.create` ne vaut jamais succès : le module persiste l’ID puis relit `refunds.retrieve` et `paymentIntents.retrieve`, vérifie ID, PaymentIntent exact, devise, montant et mode prouvé par le PaymentIntent. Seul `status: succeeded` à cette relecture renseigne `confirmedAt`. Pending reste pending ; un ID/proof divergent est conservé pour rapprochement sans succès inventé. Un montant reçu déjà commercialement imputé ne peut pas être modifié par une relecture contradictoire.

Un remboursement live confirmé d’un crédit commercial diminue le registre. S’il remet une facture acquittée en dette, `paidAt` est effacé et un dossier `paid` ou `closed` revient à `invoiced`, avec version et événement explicitant la **réouverture financière auditée, sans nouvelle intervention**. Un remboursement test ne touche jamais l’acquittement commercial. Un remboursement de fonds retenus non crédités ne révoque pas un paiement indépendant.

## UI simplifiée

`PaymentPanel({ reference, token?, status, invoice })` accepte `invoice: null` et fonctionne avant facturation pour l’acompte. Il ne s’affiche pas en l’absence de facture, échéancier ou historique. Une seule action de paiement contextuelle indique le montant réellement dû ; acceptation/refus des modalités restent distincts. Conditions et historique sont repliés. Checkout ouvre un nouvel onglet sans `opener`. Le test et les fonds à rapprocher sont signalés sans fausse mention « facture réglée ».

Intégration artisan :

```tsx
import { PaymentTools } from "@/components/mds/private-payment-tools";
<PaymentTools requestId={request.id} version={request.version} reference={request.reference} />
```

`PrivatePayments` est aussi exporté comme alias. Ce composant contextuel est replié par défaut, sans nouveau menu. La confirmation de remboursement détaille mode, montant, référence et motif et exige une case explicite. Les euros sont parsés en centimes par une syntaxe décimale exacte (pas de `parseFloat`, pas de notation exponentielle). Une confirmation ambiguë est conservée dans la session du navigateur et ne change ni montant/motif ni clé à la reprise. Les boutons de relecture ne déclenchent pas de nouvelle dépense. Aucune donnée de carte ou portefeuille n’est conservé.

## Validation et limites

Les tests paiements utilisent une DB isolée en mémoire et des mocks Stripe : les clés factices test/live ne sont jamais utilisées par le vrai réseau. Le test HTTP de signature existant utilise le véritable vérificateur SDK sur données synthétiques localhost, pas l’API Stripe. Aucun paiement ou remboursement externe, même test, n’a été lancé pendant ce développement. Les 33 régressions historiques sont conservées ; les nouveaux cas couvrent consentement, tarif fixe/devis réel, contrat changé, acompte avant facture, crédit test/live, solde, réservations inter-étapes, reçu malformé/discordant, cap réel 100/150 €, propriétaire, checkbox, mode, timeout, idempotence concurrente, relecture pending/succeeded, preuves étrangères et réouverture financière.

Commandes : `pnpm exec vitest run server/mds/payment.test.ts` ; `pnpm check`. Le build global, les migrations additives, la revue du moteur et le raccord UI parent restent à coordonner avec les autres périmètres. Ni les mocks ni l’activation de clés ne prouvent une livraison webhook réelle ou un parcours E2E bancaire. La mise en service live relève exclusivement du propriétaire, via configuration approuvée et publication ; cette livraison ne publie ni ne commite.

### Résultats vérifiés le 5 novembre 2026

`server/mds/payment.test.ts` : **64/64 tests passent**, dont les 33 tests historiques conservés. `pnpm check` : réussi sans erreur TypeScript. Relecture globale au même instant : **248/248 tests passent dans 11 fichiers** (`/tmp/mds-pay-global-final.log`). Ces nombres décrivent la copie partagée à cet instant ; les autres périmètres peuvent encore évoluer. Aucun appel de création Stripe réel, aucune migration ou donnée client, aucun commit ou publication effectué par ce périmètre.
