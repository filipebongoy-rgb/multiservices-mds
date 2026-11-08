

## Notifications de réservation — 8 novembre 2026

La confirmation client d’un créneau passe par `requests.clientAction(confirm)`. Le rendez-vous et l’événement `confirmed` sont d’abord enregistrés dans une transaction. Après son commit, `processOutbox` est appelé immédiatement pour tenter l’e-mail et le SMS de l’artisan lorsque les canaux sont activés et configurés. Une erreur Resend/Twilio est isolée : la réservation reste valide et la file durable ainsi que la maintenance planifiée assurent la reprise et la déduplication.

## Mot de passe oublié et accès artisan — 8 novembre 2026

Le parcours local comprend maintenant une demande de réinitialisation à réponse neutre. Le serveur ne stocke que le hash SHA-256 d’un jeton aléatoire, expirant après 30 minutes et marqué comme utilisé après validation. Le nouveau mot de passe est recalculé avec scrypt et toutes les sessions locales de l’utilisateur sont invalidées. L’e-mail de reset passe par la file MDS/Resend lorsque le canal est configuré ; sinon aucune information n’est révélée sur l’existence du compte. Le pied de page public propose « Accès artisan », qui ouvre `/connexion?returnTo=%2Fartisan` sans exposer directement l’atelier.
