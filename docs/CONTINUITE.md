

## Notifications de réservation — 8 novembre 2026

La confirmation client d’un créneau passe par `requests.clientAction(confirm)`. Le rendez-vous et l’événement `confirmed` sont d’abord enregistrés dans une transaction. Après son commit, `processOutbox` est appelé immédiatement pour tenter l’e-mail et le SMS de l’artisan lorsque les canaux sont activés et configurés. Une erreur Resend/Twilio est isolée : la réservation reste valide et la file durable ainsi que la maintenance planifiée assurent la reprise et la déduplication.
