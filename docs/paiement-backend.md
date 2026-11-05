# Backend paiement MDS

## Branchement et contrat

Le parent importe `paymentsRouter` depuis `server/mds/payments.ts` dans le routeur métier et appelle `registerPaymentWebhook(app)` depuis `server/mds/payment-webhook.ts` **avant** `express.json()` et tout parseur consommant le corps. La route est `POST /api/stripe/webhook`. Aucun changement de schéma, migration, routeur principal ou frontend n’est effectué par ce module.

- `payments.config` est une query publique : `{ enabled, mode: 'test' | 'live' | 'unavailable' }`. Le mode est dérivé du préfixe de la clé secrète ; une clé de signature absente désactive Checkout. Aucune clé n’est retournée.
- `payments.list({ reference, token? })` renvoie exactement un tableau. L’autorisation du dossier est contrôlée avant la lecture : un token de suivi ne remplace jamais l’appartenance actuelle à une organisation.
- `payments.mine()` exige une identité authentifiée et utilise `requestFilter` : dossiers particuliers de l’identité et dossiers d’organisations dont elle est membre, ou tous les dossiers pour l’artisan propriétaire autorisé. C’est un tableau avec `requestReference` et `serviceName` supplémentaires. **`reference` est la référence du paiement ; `requestReference` est la référence du dossier** : l’UI doit afficher cette dernière pour naviguer dans les demandes.
- Les champs publics de paiement sont `id`, `provider`, `mode`, `status`, `amountCents`, `currency`, `reference`, `expiresAt`, `confirmedAt`, `createdAt`, `updatedAt`. Aucun identifiant Stripe, clé d’idempotence, commentaire privé, URL stockée, email ou donnée bancaire n’est exposé par les historiques.
- `payments.checkout({ reference, token?, origin })` retourne exactement `{ url, mode }`. Ouvrir Checkout dans un nouvel onglet et informer du passage sur Stripe.

Le retour est `/paiements?ref=REFERENCE&checkout=retour` ; l’annulation navigue avec `checkout=annule`. **Ni le retour, ni son paramètre, ni l’annulation ne mutent le statut du dossier.** Le token privé reste dans le navigateur : aucun bearer dans les URL ou métadonnées Stripe.

## Montant et identité

Le prix provient exclusivement de `invoices.amountCents` et de la devise de la facture, jamais d’un tarif courant, d’un prix envoyé par le navigateur ou d’un document legacy. Une facture sans montant validé, à zéro, inférieure à 50 centimes ou hors EUR est refusée. Checkout exige un dossier `invoiced` et une facture non acquittée. Une vérification manuelle existante interdit un nouveau Checkout.

L’email OAuth du payeur authentifié est préféré ; un invité utilise l’email original de la demande. Les métadonnées métier (`request_id`, `invoice_id`, `payment_id`, `checkout_key`, `user_id` si connecté, `customer_email`, `customer_name`) sont transmises sur la session et sur `payment_intent_data`. Les valeurs descriptives sont bornées à 255 caractères. `client_reference_id` est la référence dossier.

`allow_promotion_codes: true` est imposé par le contrat Stripe. Cela **n’autorise pas** à acquitter une facture à un montant réduit : le webhook compare le montant effectivement signé au montant immuable réservé et au montant actuel de facture. Une remise créant une divergence est conservée dans le registre comme succès fournisseur **sans acquittement** et nécessite un rapprochement artisan. L’UI doit prévenir que le montant accepté est celui validé par le serveur et qu’un code ne garantit pas la validation de la facture.

## Origine navigateur

`origin` doit être exactement une origine URL, sans chemin, slash final, identifiants, query ou fragment. Elle doit correspondre à l’en-tête navigateur `Origin`, ou à l’origine du `Referer` si `Origin` est absent. HTTPS est requis ; HTTP localhost/127.0.0.1/::1 est permis uniquement hors production. `Host` et `X-Forwarded-Host` ne servent jamais à construire les retours.

Une valeur serveur facultative `MDS_PUBLIC_ORIGIN` (ou `PUBLIC_APP_ORIGIN`) restreint en plus le retour à l’origine publique exacte configurée. Aucune URL de Preview n’est codée en dur. En l’absence de configuration, le navigateur doit quand même fournir son origine et elle doit coïncider avec l’entrée.

## Idempotence durable

La création réserve un paiement et une `checkoutKey` sous transaction avec verrou `settings`, identique à celui des actions métier/facture. La transaction est libérée **avant** l’appel Stripe. Deux demandes concurrentes de la même facture et du même mode réutilisent la même ligne et la même clé Stripe, pas deux charges indépendantes.

Une empreinte des paramètres est incluse dans la clé persistée. Un timeout ambigu laisse la réservation en place ; le même navigateur et la même identité reprennent **exactement** les mêmes paramètres et la même clé. Une identité/origine divergente avant la réception de l’ID est refusée plutôt que de créer une deuxième session. Une fois l’ID enregistré, l’URL est récupérée auprès de Stripe ; aucune URL, réponse fournisseur brute ou client secret n’est stocké.

Les identifiants session/intent et l’expiration sont persistés, y compris si le dossier a changé pendant l’appel réseau ; le lien n’est alors pas délivré. Le webhook peut arriver avant cette persistance : ses métadonnées signées et la clé de réservation doivent correspondre aux identifiants et relations déjà enregistrés en base.

Une réservation sans ID dont la période de création est dépassée est volontairement bloquée pour rapprochement manuel. La clé n’est jamais renouvelée aveuglément après un timeout, notamment au-delà de la fenêtre de conservation d’idempotence Stripe. Une session fournisseur explicitement expirée permet une nouvelle réservation à l’essai suivant ; une session complète attend le webhook, même sans URL. Un paiement test déjà réussi ne peut pas être répété pour spammer la facture, mais n’empêche pas un futur paiement live.

## Signature, événement et argent réel

Le handler utilise les octets bruts exacts et `STRIPE_WEBHOOK_SECRET`. Une signature absente/invalide retourne HTTP 400 sans écriture en base. La déduplication du `event.id` est durable dans `paymentEvents`, sous la même transaction que les mises à jour, événements métier, audits et notifications. Une erreur transactionnelle renvoie HTTP 500 pour obtenir une livraison ultérieure ; rien n’est marqué traité avant commit.

Les six événements souscrits sont supportés : `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, et les trois événements `customer.subscription.created/updated/deleted`. Les abonnements non utilisés et paiements signés étrangers sont accusés réception sans attribution. Aucun payload brut ni numéro de carte n’est conservé.

Les succès exigent une correspondance stricte métadonnées/réservation/dossier/facture/identifiants fournisseur, la devise EUR et le montant reçu exact. `event.livemode` doit correspondre au mode des clés actives et au paiement enregistré. Les identifiants fournisseur ne peuvent être réaffectés à une autre ligne. Un événement de paiement échoué ne change pas la facture ; un échec tardif ne peut jamais annuler un succès.

**Test :** un événement valide met uniquement `payments.status = succeeded`, avec date et audit. `invoices.paidAt`, `requests.status`, événements métier de règlement et notifications de libération commerciale restent inchangés. L’UI doit indiquer « Paiement test réussi — aucun encaissement réel, facture non acquittée ».

**Live :** seul l’événement signé au montant exact, pour facture inchangée et dossier encore `invoiced`, acquitte la facture, passe le dossier à `paid`, incrémente sa version et écrit événement/audit/notifications dans la même transaction. Si un vrai règlement arrive après annulation, changement de prix ou vérification manuelle, le registre garde le succès Stripe mais la facture n’est pas acquittée automatiquement ; une notification artisan et un audit demandent le rapprochement. Aucun remboursement ou ajustement externe n’est prétendu automatique.

## Vérification et mise en service

Les tests de `server/mds/payment.test.ts` utilisent exclusivement une base privée en mémoire et des méthodes Stripe mockées. Un test HTTP utilise le vrai vérificateur de signatures SDK sur des données synthétiques et un serveur localhost, **sans appel réseau à Stripe, débit, facture client ou mutation de la base gérée**.

Commande ciblée : `pnpm exec vitest run server/mds/payment.test.ts`. Diagnostic : `pnpm check`.

La plateforme doit connecter son webhook au Preview courant ; activation/intégration configurée n’est pas preuve de livraison. Le propriétaire doit revendiquer le compte sandbox dans Settings → Integrations. Pour un essai utilisateur, utiliser la carte de test `4242 4242 4242 4242`, pas une carte réelle. Le passage live relève du propriétaire : clés live dans Settings → Integrations puis republication. Ce développement n’effectue aucune opération de paiement externe, même en test.

### Limites honnêtes

Les notifications sont internes uniquement ; aucune livraison email/SMS, aucun monitor autonome d’expiration, aucun remboursement, litige, rapprochement automatique ou abonnement commercial n’est inclus. Une réservation ambiguë/une remise/un règlement arrivé sur un dossier changé exige une vérification Dashboard Stripe par l’artisan. Le registre conserve le montant de facture réservé, pas une copie du payload Stripe ; le détail fournisseur nécessaire à ce rapprochement doit être consulté dans Stripe.

## Correctifs de revue ciblée

La déclaration manuelle de règlement est interdite aussi pour une tentative Stripe live `failed` tant que sa session reste réutilisable : un échec de carte ne vaut pas expiration de Checkout. Les réservations explicitement expirées/annulées restent distinctes. Une régression tarifaire couvre pending et failed avec conservation de facture et dossier.

Dans les deux historiques client, le montant d’une ligne Stripe est nommé « Montant contractuel réservé ». Le registre conserve ce montant contractuel, pas une somme reçue divergente inventée. « Versement reçu » décrit la confirmation fournisseur ; cela n’acquitte pas à lui seul la facture. L’interface signale le rapprochement, masque un nouveau Checkout après fonds reçus, et identifie les essais qui ne règlent jamais la facture réelle.
