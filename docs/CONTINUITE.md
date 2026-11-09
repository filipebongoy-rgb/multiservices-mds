

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
