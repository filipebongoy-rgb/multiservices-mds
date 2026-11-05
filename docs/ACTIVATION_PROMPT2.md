# Mise en service du moteur MDS

Le code du PROMPT 2/3 fonctionne dans le même projet. La publication n’a pas été autorisée pendant ce développement. Stripe demeure en test, les fournisseurs de notifications restent à choisir/configurer et aucun cron n’est activé.

## Avant ouverture

Le propriétaire doit activer son identité artisan, renseigner ses informations légales, ses horaires, zones postales et durées de déplacement. Le calendrier reste désactivé tant que les disponibilités ne sont pas validées. Les prestations inactives ne deviennent pas réservable par un seed ou un test. Les devis et la politique d’annulation/paiement doivent être revus pour la situation réelle de MDS ; les champs structurés ne constituent pas une certification juridique.

## Notifications

Après confirmation du choix de fournisseur, utiliser la saisie protégée du projet pour `MDS_RESEND_API_KEY`, `MDS_TWILIO_ACCOUNT_SID` et `MDS_TWILIO_AUTH_TOKEN`. Ne jamais copier de clé dans le code ou le chat. L’expéditeur e-mail et l’expéditeur SMS doivent être autorisés par leurs fournisseurs. Renseigner ensuite l’adresse HTTPS publique de l’application dans Planning → Paramètres → Notifications et rappels, puis activer uniquement les canaux configurés. Les numéros SMS doivent être internationaux explicites. Un test de livraison devra être effectué avec un destinataire choisi par le propriétaire, sans faux dossier métier.

## Maintenance native après publication

Publier d’abord un checkpoint contenant le callback `/api/scheduled/mds-maintenance`. Sur le projet publié et avec autorisation d’activation, créer une tâche native, puis lier l’identifiant retourné à la base. La tâche doit s’exécuter au moins une fois avant d’affirmer que le traitement autonome est opérationnel.

```bash
manus-heartbeat create \
  --name mds-operational-maintenance \
  --cron '0 */5 * * * *' \
  --path /api/scheduled/mds-maintenance \
  --method POST \
  --payload '{}' \
  --description 'Expirations, rappels MDS et file de notifications'

# Remplacer par le taskUid réellement retourné, pas par un exemple fictif.
MDS_MAINTENANCE_TASK_UID='<taskUid retourné>' pnpm exec tsx scripts/bind-maintenance.ts
```

Le script vérifie que l’identifiant appartient à une tâche native active du projet et au bon callback avant de le persister. Il refuse de remplacer silencieusement une autre tâche. Le callback vérifie la signature, le projet, l’expiration et l’identité `taskUid` résolue auprès du service OAuth ; le corps de la requête ne choisit jamais le dossier à traiter.

Vérifier `manus-heartbeat logs --help` puis les exécutions dans le Dashboard et dans le journal de l’application. Une erreur d’identité avant publication n’est pas une expiration exécutée. Les rappels préparés restent dans le registre, et l’expiration/rappel/message est dédupliqué. L’écran permet un traitement manuel confirmé pour la reprise.

## Paiements commerciaux

Le prestataire est réel mais les clés actuelles sont des clés de test. Les essais réussis ne règlent aucune facture commerciale. Le propriétaire doit revendiquer le compte sandbox depuis les intégrations du Dashboard, puis suivre le passage aux clés réelles et la republication. Les remboursements exigent mode, montant, référence, motif et confirmation ; un retour de navigation ne confirme jamais un paiement ou un remboursement.
