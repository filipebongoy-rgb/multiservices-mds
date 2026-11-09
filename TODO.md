

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
