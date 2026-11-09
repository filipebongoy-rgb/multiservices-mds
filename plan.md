

# Extension — Assistante opérationnelle MDS

## Objectif

Créer dans l’espace artisan une assistante opérationnelle qui réduit l’administratif au minimum. L’artisan doit principalement traiter la prestation sur place : démarrer le trajet, intervenir, prendre les photos avant/après, recueillir la signature et terminer le dossier.

L’assistante MDS prépare et suit les tâches administratives, mais ne doit jamais engager seule l’entreprise sur une action irréversible.

## Périmètre de la première version

- **Accueil “À faire maintenant”** : prochaines demandes, rendez-vous du jour, urgences, relances en retard, devis à valider, factures à contrôler et appels à rappeler.
- **Appels** : fiche d’appel avec client, motif, dernier statut, bouton “Rappeler”, script court proposé par l’assistante et journal de l’appel. La prise d’appel et l’émission d’appels réels restent désactivées tant qu’un fournisseur téléphonique et un numéro MDS ne sont pas configurés.
- **Contrats et devis** : génération d’un brouillon à partir du dossier client, de la prestation et du tarif existant ; validation obligatoire par l’artisan avant envoi. Aucun prix inventé et aucune modification silencieuse d’un devis accepté.
- **Relances** : rappels automatiques des devis sans réponse, créneaux à confirmer, documents manquants et factures impayées. Chaque relance est visible, annulable et historisée.
- **Facturation** : préparation d’une facture après les conditions métier déjà validées ; contrôle humain avant émission, remboursement ou transfert. L’assistante ne contourne jamais la preuve photo obligatoire, la signature client ni les règles de paiement différé.
- **Intervention sur place** : accès immédiat aux boutons Démarrer, Je suis arrivé, Commencer, Ajouter photo avant, Ajouter photo après, Signature client et Terminer. Cette zone reste simple et ne doit pas être noyée dans l’administration.
- **Notifications** : e-mail/SMS utilisant les canaux MDS configurés, avec état envoyé, en attente ou échec et nouvelle tentative durable sans doublon.
- **Traçabilité** : journal des propositions de l’assistante, validations humaines, messages envoyés, rappels annulés et erreurs.

## Règles de sécurité et de responsabilité

- Une action qui envoie un contrat, un devis, une facture, un SMS, un e-mail ou un appel nécessite une validation explicite de l’artisan, sauf notification transactionnelle déjà autorisée par le workflow existant.
- L’assistante peut suggérer et préparer ; elle ne peut pas inventer un prix, confirmer une disponibilité non enregistrée, débloquer un paiement, supprimer une preuve ou clôturer une intervention sans les contrôles existants.
- Les réponses utilisent uniquement les données MDS du dossier concerné et respectent la séparation client/professionnel/artisan.
- Les actions sont idempotentes et affichent immédiatement leur état pour éviter les doubles envois.
- Les données et le journal restent dans la base MDS ; aucune donnée client n’est envoyée à un service externe non configuré.

## Architecture proposée

- `server/mds/assistant.ts` : résumé des tâches, recommandations, brouillons et actions validées.
- `server/mds/assistant-automation.ts` : relances et échéances natives MDS, avec déduplication et arrêt manuel.
- `client/src/components/mds/private-assistant.tsx` : poste de pilotage mobile-first intégré à l’espace artisan.
- Extension des entités existantes pour les tâches d’assistant, appels, brouillons, relances et journaux ; migrations additives uniquement.
- Utilisation de l’LLM intégré uniquement pour classer, résumer et rédiger des brouillons bornés par des données structurées. Le modèle exact sera sélectionné depuis le catalogue disponible au moment de l’implémentation, avec priorité à la latence et au coût pour les actions unitaires.
- Les e-mails/SMS réutilisent la file MDS existante. Les appels réels seront une extension séparée, activée seulement après configuration et test d’un fournisseur téléphonique.

## Design

**Mouvement :** atelier opérationnel calme, inspiré d’un tableau de dispatch plutôt que d’un chatbot. Probabilités alternatives : interface conversationnelle 0,08 ; dashboard analytique dense 0,06 ; assistant vocal omniprésent 0,04.

**Principes :** une prochaine action clairement mise en avant ; états visibles sans jargon ; validation au dernier moment ; séparation stricte entre travail terrain et administration.

**Palette :** anthracite et blanc pour la fiabilité, orange MDS pour l’action à effectuer, vert uniquement pour les étapes confirmées et rouge uniquement pour une erreur ou un paiement bloqué.

**Mise en page :** un bandeau fixe mobile avec les cinq espaces actuels, puis une carte “À faire maintenant” et des files courtes. Les détails s’ouvrent dans le même dossier sans renvoyer vers des écrans parallèles.

**Éléments signature :** compteur d’actions urgentes, ligne d’état “proposé / à valider / envoyé”, bouton principal unique par carte.

**Interaction :** l’assistant explique toujours pourquoi une action est proposée et ce qui manque. Les actions irréversibles affichent un aperçu puis une confirmation explicite.

**Animation :** transitions courtes uniquement pour l’apparition d’une nouvelle tâche et la confirmation d’une action ; respect de `prefers-reduced-motion`.

**Voix de marque :** directe, rassurante, professionnelle. Exemples : “Voici ce qui doit être fait maintenant.” / “Le devis est prêt à vérifier. Rien ne sera envoyé sans votre accord.”

## Déploiement par étapes

1. Poste de pilotage et tâches calculées à partir des demandes, rendez-vous, devis, paiements et notifications déjà présents.
2. Brouillons contrôlés de devis, contrats, e-mails et SMS ; relances annulables et journalisées.
3. Factures préparées et contrôles de paiement dans le flux existant.
4. Connexion téléphonique réelle uniquement après choix et configuration du fournisseur, du numéro d’appel et des règles de consentement.

## Décision à valider

Cette première version privilégie une assistante qui prépare et automatise sans envoyer seule de communication engageante. Les appels réels, l’envoi autonome de contrats et la facturation automatique restent désactivés jusqu’à configuration explicite et tests de sécurité.
