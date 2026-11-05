# Notifications MDS — préparation du PROMPT 2/3

Les notifications internes restent enregistrées dans la même transaction que l’événement métier. La file externe contient un identifiant dédupliqué par événement, audience et canal. Un destinataire ne reçoit pas de notification externe de sa propre action. Les liens de suivi restent privés ; les organisations nécessitent toujours une appartenance valide, même après un transfert de lien.

Les adaptateurs préparés sont Resend et Twilio, sous réserve du choix et de la configuration du propriétaire. Aucune clé n’est collectée dans le chat. Aucun message commercial n’a été envoyé pour tester. Les canaux désactivés ne génèrent pas un arriéré qui partirait soudainement à leur activation.

Resend reçoit un POST `/emails`, une clé d’idempotence et le texte du message. Sa documentation indique une conservation de la clé pendant 24 heures. Le registre local durable empêche les reprises d’un succès connu au-delà de cette fenêtre ; un résultat réseau inconnu nécessite une vérification manuelle, pas une relance aveugle. L’identifiant de réponse établit l’acceptation de la requête, pas la livraison. [1]

Twilio reçoit un POST au compte Messages avec `To`, `From`, `Body`. La réponse contient un identifiant et un état. `queued` et `accepted` ne signifient pas `delivered`. Aucun code pays n’est deviné : le numéro destinataire doit être explicitement international. Une erreur réseau potentiellement postérieure à l’envoi place le message en « À vérifier ». Les SMS longs sont segmentés et facturés par segment ; les messages et liens doivent rester aussi courts que possible. Les comptes d’essai peuvent exiger des destinataires vérifiés. [2]

Les erreurs 429 sont réessayées dans une limite bornée ; les erreurs de configuration sont conservées pour correction. Un worker interrompu ne renvoie pas automatiquement un message qui a peut-être déjà été envoyé. L’écran artisan permet la reprise seulement après attestation de non-envoi. Les états acceptés et livrés demeurent distincts.

L’expiration autonome et les rappels utilisent le callback natif `/api/scheduled/mds-maintenance`. La signature JWT, le projet, l’expiration et l’identité de tâche résolue par OAuth doivent être validés avant toute écriture. Un `taskUid` actif doit être persisté dans `mds_automation_tasks`. Ce travail n’est pas un timer détaché du sandbox. Sans publication, le callback est développé et testé, mais son exécution autonome n’est pas activée.

## Références
[1]: https://resend.com/docs/dashboard/emails/idempotency-keys "Resend — Idempotency Keys"
[2]: https://www.twilio.com/docs/messaging/api/message-resource "Twilio — Messages resource"

La relecture e-mail utilise `GET /emails/{id}` et ne consomme que le statut fournisseur avec l’identifiant et le destinataire exacts. `last_event: delivered` permet d’enregistrer une livraison ; les états inconnus conservent le dernier état confirmé. La relecture SMS utilise la ressource Messages du même compte et ne considère pas `queued` comme livré. [3]

[3]: https://resend.com/docs/api-reference/emails/retrieve-email "Resend — Retrieve Sent Email"
