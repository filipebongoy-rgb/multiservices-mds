

## Assistante opérationnelle artisan — première version

- [ ] Un poste de pilotage unique affiche immédiatement les demandes prioritaires, rendez-vous du jour, urgences, relances en retard, devis à valider, factures à contrôler et appels à rappeler.
- [ ] L’assistante prépare des brouillons de devis, contrats, e-mails, SMS et scripts d’appel à partir des données réelles du dossier ; elle n’invente aucun prix, aucune disponibilité et aucune information client.
- [ ] Tout envoi de contrat, devis, facture, SMS, e-mail ou appel nécessite une validation explicite de l’artisan ; les états proposé, à valider, envoyé, échec et annulé sont visibles et historisés.
- [ ] Les relances sont planifiables, dédoublonnées, annulables et réutilisent la file MDS existante sans prétendre à un envoi si le fournisseur n’est pas configuré.
- [ ] Les factures restent soumises aux contrôles métier existants : preuve photo obligatoire, signature client, validation du dossier et règles de paiement différé ; l’assistante ne débloque ni paiement ni transfert seule.
- [ ] Les appels réels restent désactivés jusqu’à configuration explicite d’un numéro, d’un fournisseur et des règles de consentement ; l’interface fournit d’abord une fiche d’appel et un script de rappel.
- [ ] L’artisan conserve une action terrain simple et prioritaire : démarrer, arriver, commencer, photos avant/après, signature et terminer.
- [ ] Les suggestions IA utilisent uniquement les données autorisées du dossier, sont bornées par des données structurées, et un repli manuel reste disponible en cas d’erreur ou d’incertitude.

### État de la première version livrée — 9 novembre 2026

- [x] Le poste de pilotage privé agrège les demandes réelles, rendez-vous du jour, interventions en cours, devis préparés, factures impayées, paiements en échec, notifications non abouties et incidents ouverts.
- [x] Les brouillons de relance e-mail, SMS et scripts d’appel sont enregistrés dans `mds_assistant_actions`, affichés avant action et bornés par les données du dossier ; un repli manuel est utilisé si l’IA est indisponible.
- [x] L’artisan doit relire et valider explicitement un brouillon avant son passage dans la file e-mail/SMS. Le canal non configuré est affiché comme un échec contrôlé, jamais comme un envoi réussi.
- [x] L’assistante n’altère pas les prix, créneaux, paiements, preuves photo ou signatures et ne déclenche pas d’appel réel.
- [ ] La planification avancée de relances, la génération de contrats/devis complets et l’intégration d’un fournisseur téléphonique restent une étape distincte ; elles ne sont pas simulées dans cette version.

## Agent vocal propriétaire MDS sans Retell

- [x] Le serveur contient un agent vocal natif fondé sur Twilio Voice + IA MDS, sans dépendance Retell.
- [x] Les routes `/api/voice/incoming`, `/api/voice/respond`, `/api/voice/outbound` et `/api/voice/status` sont préparées avec réponses TwiML en français, collecte de parole, réponse IA courte et suivi des statuts.
- [x] Les signatures `X-Twilio-Signature` sont vérifiées avant traitement ; les appels sont refusés si l’origine publique, les secrets ou le numéro Voice ne sont pas configurés.
- [x] L’assistante affiche l’état de préparation et peut lancer un appel sortant depuis un brouillon lorsque le fournisseur sera configuré.
- [x] Les appels réels restent désactivés tant que les identifiants fournisseur ne sont pas fournis ; aucune dépense ni appel n’a été lancé dans cette passe.
- [x] Le journal relationnel des appels est préparé pour conserver le statut, la direction et le dossier associé.

## Confirmation autonome des rendez-vous

- [x] Les demandes avec créneau proposé, prix contractuel valide, informations suffisantes et aucun devis en attente apparaissent comme « Confirmer le rendez-vous prêt ».
- [x] La confirmation réutilise la vérification de calendrier, zone, déplacement, durée, conflits et prix ; elle crée un seul rendez-vous et une intervention dans une transaction.
- [x] Une demande sans créneau, avec devis requis/non accepté, conflit de planning ou information incohérente reste bloquée avec le motif métier explicite.
- [x] La confirmation est auditée et déclenche les notifications de réservation après le commit ; elle ne lance aucune intervention et ne remplace pas les photos, la signature ou la fin de chantier.

## Équipe terrain et autonomie opérationnelle

- [x] L’administrateur peut ajouter un artisan collaborateur par adresse e-mail ; un compte existant est activé, et une invitation en attente est activée automatiquement lors de l’inscription correspondante.
- [x] L’administrateur peut affecter une intervention à un collaborateur actif et celui-ci reçoit une notification de planning.
- [x] Un collaborateur possède un compte séparé et ne voit que les demandes qui lui sont affectées ; il ne voit ni paiements, ni contrats globaux, ni activité client globale, ni paramètres MDS.
- [x] L’administrateur peut révoquer l’accès d’un collaborateur ; les affectations restent historisées.
- [x] L’affectation automatique utilise la zone MDS par défaut et la charge des affectations ouvertes ; les compétences et zones personnelles peuvent être précisées ultérieurement.

## Navigation artisan sans défilement inutile

- [x] Chaque espace principal de l’atelier possède désormais sa route dédiée : `/artisan/assistant`, `/artisan/demandes`, `/artisan/planning`, `/artisan/interventions`, `/artisan/settlements`, `/artisan/activity` et `/artisan/team`.
- [x] Un clic sur un onglet ouvre la page correspondante et réinitialise la vue, au lieu de laisser l’utilisateur chercher l’information plus bas dans un écran unique.
- [x] Sur mobile, la barre fixe affiche cinq accès équilibrés : Assistant, Demandes, Planning, Interventions et Plus. Les règlements, l’activité et l’équipe sont regroupés dans un menu Plus accessible et visible.
- [x] Le dernier élément n’est plus coupé par la largeur de l’écran ; les libellés et icônes sont répartis dans une grille mobile stable.

## Affectation automatique par défaut

- [x] Tout collaborateur actif est désormais considéré compétent pour l’ensemble du catalogue MDS et couvert par la zone par défaut Rennes + 30 km, même si ses spécialités et sa zone personnelle ne sont pas encore renseignées.
- [x] Après confirmation automatique d’un rendez-vous, l’assistante affecte le dossier au collaborateur actif le moins chargé et ajoute l’intervention à son planning.
- [x] La disponibilité opérationnelle est estimée par la charge des affectations actives ; l’affectation reste protégée contre les doublons par la contrainte unique du dossier.
- [x] Le collaborateur reçoit une notification et l’assistant indique clairement le nom de l’artisan affecté. En l’absence de collaborateur, le dossier reste au planning de l’artisan MDS principal.

## Contrôle rapide et nettoyage des demandes — 9 novembre 2026

- [x] L’assistante affiche désormais un en-tête court, des compteurs compacts et une liste d’actions dense ; les explications permanentes et le panneau brouillon vide ne prennent plus de place.
- [x] Une ligne de tâche ouvre directement le dossier au toucher. Les relances utilisent une action unique « Préparer la relance » au lieu de trois boutons répétés.
- [x] L’historique des brouillons est replié par défaut et ne pousse plus les actions urgentes vers le bas de l’écran.
- [x] L’administrateur peut retirer une demande terminée, refusée, annulée, expirée, clôturée, payée ou facturée avec confirmation explicite. Le retrait est réversible côté données via `deletedAt`, audité et exclu des listes actives.
- [x] Une demande encore active ne peut pas être retirée silencieusement ; elle doit d’abord être annulée ou terminée selon le workflow métier.

## Alerte téléphone lors d’une affectation

- [x] Lorsqu’une notification serveur « Nouvelle intervention affectée » apparaît, l’espace artisan la détecte toutes les 5 secondes et déclenche une notification navigateur sur le téléphone si l’autorisation est active.
- [x] Un bouton « Activer les alertes téléphone » demande l’autorisation au premier usage ; l’écran indique clairement si les alertes sont actives ou bloquées par les réglages du navigateur.
- [x] L’alerte reprend le message du dossier, utilise le logo MDS et évite les doublons pendant la session grâce à l’identifiant de notification.
- [x] La notification interne reste persistée et visible même si le téléphone refuse les notifications navigateur.
- [ ] Les notifications lorsque le navigateur est complètement fermé nécessiteront une extension Web Push avec clés VAPID ; cette étape n’est pas activée sans configuration fournisseur.

## Clarification de l’assistante après test vidéo — 9 novembre 2026

- [x] Le titre ambigu « À faire maintenant » est remplacé par « Missions et actions ».
- [x] Une explication courte précise le fonctionnement : une mission affectée apparaît dans la liste, puis le bouton « Ouvrir la mission » mène au dossier et au planning.
- [x] Chaque tâche liée à un dossier affiche maintenant une action visible ; le clic sur toute la ligne reste également actif.
- [x] L’état de l’affectation est écrit dans le détail : « Affectée à [artisan] » ou « Affectation à confirmer ».
- [x] Les onglets artisan utilisent de vrais liens de route, notamment « Demandes », afin d’ouvrir une page dédiée au lieu de simplement faire défiler l’écran courant.
