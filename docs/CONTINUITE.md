

## Notifications de réservation — 8 novembre 2026

La confirmation client d’un créneau passe par `requests.clientAction(confirm)`. Le rendez-vous et l’événement `confirmed` sont d’abord enregistrés dans une transaction. Après son commit, `processOutbox` est appelé immédiatement pour tenter l’e-mail et le SMS de l’artisan lorsque les canaux sont activés et configurés. Une erreur Resend/Twilio est isolée : la réservation reste valide et la file durable ainsi que la maintenance planifiée assurent la reprise et la déduplication.

## Mot de passe oublié et accès artisan — 8 novembre 2026

Le parcours local comprend maintenant une demande de réinitialisation à réponse neutre. Le serveur ne stocke que le hash SHA-256 d’un jeton aléatoire, expirant après 30 minutes et marqué comme utilisé après validation. Le nouveau mot de passe est recalculé avec scrypt et toutes les sessions locales de l’utilisateur sont invalidées. L’e-mail de reset passe par la file MDS/Resend lorsque le canal est configuré ; sinon aucune information n’est révélée sur l’existence du compte. Le pied de page public propose « Accès artisan », qui ouvre `/connexion?returnTo=%2Fartisan` sans exposer directement l’atelier.

## Accès administrateur supplémentaire — 8 novembre 2026

Après confirmation explicite, `sakhale072022@gmail.com` a été ajoutée à `mds_admin_invites` avec le statut `active`. Aucun compte ni mot de passe n’a été créé à sa place. Lors de sa première inscription locale ou de sa connexion OAuth, la synchronisation des utilisateurs lui attribuera automatiquement le rôle `admin`, comme pour les invitations MDS existantes.

## Assistante opérationnelle artisan — 9 novembre 2026

La première version ajoute un onglet « Assistant » dans l’atelier privé. Le tableau agrège les demandes à traiter, rendez-vous du jour, interventions en cours, devis préparés, factures impayées, paiements en échec, notifications non abouties et incidents ouverts à partir des tables métier existantes. L’ordre est priorisé urgent, aujourd’hui puis relance.

Les brouillons de relance e-mail, SMS et scripts d’appel sont générés à partir des faits du dossier, avec `gpt-5-mini` en effort faible et un modèle de secours déterministe si l’IA est indisponible. Chaque proposition est enregistrée dans `mds_assistant_actions` avec son destinataire, son statut et son historique. Aucun envoi n’est déclenché par l’affichage ou par la génération : l’artisan doit relire puis valider explicitement. La validation e-mail/SMS réutilise la file outbox MDS et indique clairement si le fournisseur est absent, désactivé, accepté ou en échec.

Les appels téléphoniques réels ne sont pas automatisés dans cette version : l’assistant prépare une fiche et un script, puis l’artisan ouvre le dossier et appelle manuellement. L’assistante ne fixe pas de prix, ne confirme pas de rendez-vous, ne débloque pas de paiement et ne remplace pas les contrôles de preuve photo, signature client et validation de fin de travaux.

## Agent vocal propriétaire MDS — préparation sans fournisseur

Le 9 novembre 2026, MDS a préparé un agent vocal natif sans Retell. Twilio Voice sert uniquement de transport téléphonique lorsque ses paramètres seront fournis ; les réponses et règles métier restent côté MDS avec l’IA intégrée. Les routes entrantes, sortantes, de réponse, de statut et de vérification de signature sont présentes. En l’absence d’origine publique, de numéro Voice ou de secrets Twilio, elles refusent l’appel et ne lancent aucune dépense. Le journal `mds_voice_call_logs` conserve les états nécessaires au suivi. La configuration sécurisée des identifiants a été annulée et devra être relancée séparément avant tout appel réel.

## Confirmation autonome des rendez-vous — 9 novembre 2026

L’assistante peut maintenant confirmer un rendez-vous prêt lorsque la demande possède un créneau proposé, un prix contractuel valide et aucun devis en attente. La confirmation passe par une transaction unique, réutilise le verrou principal, vérifie la zone, la durée, les temps de déplacement, les indisponibilités et les conflits, puis crée le rendez-vous et l’intervention. Toute anomalie reste bloquée avec le motif métier ; l’action est auditée et les notifications sont traitées après commit.

## Équipe terrain et collaborateurs — 9 novembre 2026

MDS possède maintenant les tables `mds_artisan_team` et `mds_artisan_assignments`. L’administrateur peut ajouter un collaborateur par e-mail, avec un rôle technicien ou assistant, puis lui affecter un dossier. Si le compte existe, l’accès est actif immédiatement ; sinon l’invitation reste en attente et s’active lors de l’inscription locale avec la même adresse.

Un collaborateur actif ouvre un atelier limité aux demandes, au planning et aux interventions. Le filtrage serveur porte sur les affectations réelles : il ne peut pas consulter les autres dossiers, les paiements, les contrats, l’activité globale, l’assistante de pilotage ou les paramètres. Les actions sensibles restent réservées à l’administrateur MDS. La révocation est auditée et n’efface pas l’historique.

L’affectation automatique par distance, disponibilité et compétence n’est pas encore activée : elle nécessitera les zones, spécialités et disponibilités propres à chaque collaborateur afin d’éviter une affectation incorrecte.
