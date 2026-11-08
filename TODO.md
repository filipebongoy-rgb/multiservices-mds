

## Notification artisan après réservation

- [x] Lorsqu’un client confirme un créneau réellement disponible, le rendez-vous est créé puis la file e-mail/SMS artisan est traitée immédiatement.
- [x] Les notifications utilisent les canaux configurés dans MDS, Resend pour l’e-mail et Twilio pour le SMS, avec le numéro au format international pour le SMS.
- [x] Une panne de fournisseur ne supprime ni n’annule le rendez-vous : la file durable conserve l’état et le traitement planifié peut reprendre l’envoi sans doublon.

## Authentification et accès artisan

- [x] L’inscription et la connexion imposent l’adresse e-mail et le mot de passe.
- [x] Les champs de mot de passe peuvent être affichés ou masqués avant validation, sans jamais être stockés en clair.
- [x] Le lien « Mot de passe oublié ? » répond de manière neutre puis envoie un lien e-mail à usage unique, valable 30 minutes, lorsque le canal e-mail MDS est configuré.
- [x] La création d’un nouveau mot de passe invalide les sessions locales existantes et rend le lien inutilisable après usage.
- [x] Un lien public « Accès artisan » mène directement à la connexion avec retour vers l’atelier ; l’adresse e-mail reste obligatoire.

## Administrateur supplémentaire autorisé

- [x] `sakhale072022@gmail.com` possède désormais une invitation administrateur active.
- [x] Après création ou prochaine connexion du compte, l’adresse sera promue automatiquement administrateur/artisan et partagera l’espace MDS existant.
