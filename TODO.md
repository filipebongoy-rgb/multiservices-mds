

## Notification artisan après réservation

- [x] Lorsqu’un client confirme un créneau réellement disponible, le rendez-vous est créé puis la file e-mail/SMS artisan est traitée immédiatement.
- [x] Les notifications utilisent les canaux configurés dans MDS, Resend pour l’e-mail et Twilio pour le SMS, avec le numéro au format international pour le SMS.
- [x] Une panne de fournisseur ne supprime ni n’annule le rendez-vous : la file durable conserve l’état et le traitement planifié peut reprendre l’envoi sans doublon.
