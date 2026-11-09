

## Notifications de réservation — 8 novembre 2026

La confirmation client d’un créneau passe par `requests.clientAction(confirm)`. Le rendez-vous et l’événement `confirmed` sont d’abord enregistrés dans une transaction. Après son commit, `processOutbox` est appelé immédiatement pour tenter l’e-mail et le SMS de l’artisan lorsque les canaux sont activés et configurés. Une erreur Resend/Twilio est isolée : la réservation reste valide et la file durable ainsi que la maintenance planifiée assurent la reprise et la déduplication.

## Mot de passe oublié et accès artisan — 8 novembre 2026

Le parcours local comprend maintenant une demande de réinitialisation à réponse neutre. Le serveur ne stocke que le hash SHA-256 d’un jeton aléatoire, expirant après 30 minutes et marqué comme utilisé après validation. Le nouveau mot de passe est recalculé avec scrypt et toutes les sessions locales de l’utilisateur sont invalidées. L’e-mail de reset passe par la file MDS/Resend lorsque le canal est configuré ; sinon aucune information n’est révélée sur l’existence du compte. Le pied de page public propose « Accès artisan », qui ouvre `/connexion?returnTo=%2Fartisan` sans exposer directement l’atelier.

## Accès administrateur supplémentaire — 8 novembre 2026

Après confirmation explicite, `sakhale072022@gmail.com` a été ajoutée à `mds_admin_invites` avec le statut `active`. Aucun compte ni mot de passe n’a été créé à sa place. Lors de sa première inscription locale ou de sa connexion OAuth, la synchronisation des utilisateurs lui attribuera automatiquement le rôle `admin`, comme pour les invitations MDS existantes.

## Assistante opérationnelle artisan — 9 novembre 2026

La première version ajoute un onglet « Assistant » dans l’atelier privé. Le tableau agrège les demandes à traiter, rendez-vous du jour, interventions en cours, devis préparés, factures impayées, paiements en échec, notifications non abouties et incidents ouverts à partir des tables métier existantes. L’ordre est priorisé urgent, aujourd’hui puis relance.

Les brouillons de relance e-mail, SMS et scripts d’appel sont générés à partir des faits du dossier, avec `gpt-5-mini` en effort faible et un modèle de secours déterministe si l’IA est indisponible. Chaque proposition est enregistrée dans `mds_assistant_actions` avec son destinataire, son statut et son historique. Aucun envoi n’est déclenché par l’affichage ou par la génération : l’artisan doit relire puis valider explicitement. La validation e-mail/SMS réutilise la file outbox MDS et indique clairement si le fournisseur est absent, désactivé, accepté ou en échec.

Les appels téléphoniques réels ne sont pas automatisés dans cette version : l’assistant prépare une fiche et un script, puis l’artisan appelle manuellement. L’assistante ne fixe pas de prix, ne confirme pas de rendez-vous, ne débloque pas de paiement et ne remplace pas les contrôles de preuve photo, signature client et validation de fin de travaux.

## Agent vocal propriétaire MDS — préparation sans fournisseur

Le 9 novembre 2026, MDS a préparé un agent vocal natif sans Retell. Twilio Voice sert uniquement de transport téléphonique lorsque ses paramètres seront fournis ; les réponses et règles métier restent côté MDS avec l’IA intégrée. Les routes entrantes, sortantes, de réponse, de statut et de vérification de signature sont présentes. En l’absence d’origine publique, de numéro Voice ou de secrets Twilio, elles refusent l’appel et ne lancent aucune dépense. Le journal `mds_voice_call_logs` conserve les états nécessaires au suivi. La configuration sécurisée des identifiants a été annulée et devra être relancée séparément avant tout appel réel.

## Confirmation autonome des rendez-vous — 9 novembre 2026

L’assistante peut maintenant confirmer un rendez-vous prêt lorsque la demande possède un créneau proposé, un prix contractuel valide et aucun devis en attente. La confirmation passe par une transaction unique, réutilise le verrou principal, vérifie la zone, la durée, les temps de déplacement, les indisponibilités et les conflits, puis crée le rendez-vous et l’intervention. Toute anomalie reste bloquée avec le motif métier ; l’action est auditée et les notifications sont traitées après commit.

## Équipe terrain et collaborateurs — 9 novembre 2026

MDS possède maintenant les tables `mds_artisan_team` et `mds_artisan_assignments`. L’administrateur peut ajouter un collaborateur par e-mail, avec un rôle technicien ou assistant, puis lui affecter un dossier. Si le compte existe, l’accès est actif immédiatement ; sinon l’invitation reste en attente et s’active lors de l’inscription locale avec la même adresse.

Un collaborateur actif ouvre un atelier limité aux demandes, au planning et aux interventions. Le filtrage serveur porte sur les affectations réelles : il ne peut pas consulter les autres dossiers, les paiements, les contrats, l’activité globale, l’assistante de pilotage ou les paramètres. Les actions sensibles restent réservées à l’administrateur MDS. La révocation est auditée et n’efface pas l’historique.

L’affectation automatique par distance, disponibilité et compétence n’est pas encore activée : elle nécessitera les zones, spécialités et disponibilités propres à chaque collaborateur afin d’éviter une affectation incorrecte.

## Navigation artisan par pages — 9 novembre 2026

L’atelier artisan n’utilise plus une longue page unique pour tous les espaces. Les sections Assistant, Demandes, Planning, Interventions, Règlements, Activité et Équipe disposent de routes dédiées sous `/artisan/*`. Le changement de section passe par l’URL et remet la page en haut, ce qui rend le bouton Retour du navigateur cohérent.

Sur téléphone, la barre fixe principale est limitée à cinq accès équilibrés. Les trois espaces secondaires sont accessibles dans un menu « Plus » qui s’ouvre au-dessus de la barre. La grille utilise cinq colonnes flexibles, des libellés courts et une largeur minimale nulle afin que le dernier bouton reste visible sans défilement horizontal.

## Affectation automatique par défaut — 9 novembre 2026

Les collaborateurs actifs sont maintenant éligibles par défaut à toutes les prestations du catalogue MDS et à la zone Rennes + 30 km, même si leurs spécialités ou zones personnelles ne sont pas encore renseignées. Après la confirmation autonome d’un rendez-vous, MDS choisit le collaborateur actif ayant le moins d’affectations ouvertes, crée l’affectation dans la même transaction et ajoute une notification à son planning. Si aucun collaborateur n’est actif, le dossier reste affecté au planning de l’artisan MDS principal.

Cette règle est un défaut opérationnel et non une certification individuelle : l’administrateur pourra préciser les spécialités et zones ultérieurement. La contrainte unique sur le dossier empêche les doubles affectations.

## Contrôle rapide et nettoyage des demandes — 9 novembre 2026

L’analyse vidéo a confirmé que l’assistante était trop longue : cartes volumineuses, bouton « Ouvrir » répété, trois actions de relance par ligne, avertissements permanents et historique toujours ouvert. Le poste affiche maintenant un contrôle rapide compact. Un clic sur une ligne ouvre le dossier, une seule action prépare la relance, le panneau de brouillon n’apparaît qu’après sélection et l’historique est replié.

Les demandes de test peuvent être retirées par l’administrateur avec le mot de confirmation `SUPPRIMER`. Le serveur n’autorise ce retrait que pour les dossiers terminés ou inactifs, renseigne `deletedAt`, annule les rendez-vous confirmés et affectations encore ouvertes, écrit un audit et exclut la demande des listes. Les demandes actives restent protégées.

## Alerte téléphone lors d’une affectation — 9 novembre 2026

L’affectation d’une intervention crée déjà une notification artisan persistée côté serveur. L’espace artisan la lit désormais toutes les cinq secondes. Lorsqu’une nouvelle notification porte le titre « Nouvelle intervention affectée », le navigateur mobile affiche une alerte système après autorisation de l’artisan. Un bouton dédié permet d’activer les alertes et explique le cas de refus dans les réglages du téléphone. Les identifiants évitent les doublons pendant la session ; la cloche MDS reste la source persistante.

Ce mécanisme fonctionne lorsque l’espace MDS est ouvert ou actif dans le navigateur. La réception navigateur lorsque l’application est totalement fermée nécessite Web Push/VAPID et sera activée séparément, avec une configuration sécurisée.

## Clarification de l’assistante après test vidéo — 9 novembre 2026

La vidéo a montré que l’artisan ne comprenait ni le titre « À faire maintenant », ni le rôle de l’assistante, et que le clic sur la navigation « Demandes » semblait seulement faire défiler l’écran. L’interface affiche maintenant « Missions et actions », explique en une phrase que l’assistante prépare le planning et les dossiers, et présente « Ouvrir la mission » comme action visible sur chaque tâche. Les tâches indiquent également l’affectation réelle ou « Affectation à confirmer ».

Les navigations haute et basse de l’atelier sont désormais de vrais liens vers `/artisan/requests`, `/artisan/planning` et les autres routes dédiées, ce qui évite une dépendance à un simple changement d’état local.
