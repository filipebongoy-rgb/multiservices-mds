# MULTISERVICES MDS — Bilan intermédiaire du PROMPT 3/3

La partie 3/3 continue dans le même projet MDS, sans reconstruction, sans marketplace et sans activation commerciale ou externe supplémentaire. Les contraintes « Manus lite uniquement » ont été respectées pour les revues indépendantes : deux analyses lecture seule en niveau lite ont été utilisées ; aucun niveau max n’a été utilisé.

## Développé dans cette étape

La création d’une demande ne crée plus systématiquement une nouvelle fiche client. Le serveur réutilise d’abord l’identité authentifiée, puis rapproche prudemment les coordonnées normalisées d’une même organisation lorsque l’e-mail et le téléphone correspondent exactement. Sinon, il crée une fiche. La décision reste côté serveur et ne fusionne pas des personnes sur le seul nom ou sur une correspondance approximative.

L’espace artisan dispose maintenant d’une section contextuelle « Clients » dans ses paramètres, sans nouveau menu principal. Elle permet de rechercher les fiches existantes, d’ouvrir une fiche et de consulter son historique réel de demandes. Les données restent derrière l’authentification artisan ; aucune fiche de démonstration n’a été créée.

Les contrats professionnels ne sont plus seulement indexés. Dans l’espace de l’organisation, un gestionnaire ou propriétaire peut modifier le nom, l’état indexé/actif/terminé et les dates de début/fin. Le serveur vérifie l’appartenance à l’organisation, l’ordre des dates, verrouille le contrat et écrit un audit. Le PDF lié reste privé et inchangé.

Le routeur clients est branché au routeur MDS existant. La mutation d’édition contractuelle est branchée au routeur organisations existant. L’interface conserve les trois entrées professionnelles Déclarer, Suivre et Bâtiments ; les clients et l’édition de contrat restent des actions contextuelles, conformément à la priorité UX.

## Contrôles

`pnpm check` est propre. `pnpm test` réussit avec **257 tests dans 13 fichiers**, dont deux régressions dédiées au rapprochement client. `pnpm build` réussit. La santé HTTP répond 200 et le manifeste des neuf routes publiques répond en JSON 200. Les tests n’ont écrit aucun client, contrat ou dossier de démonstration dans la base partagée.

## Encore ouvert

Le CRUD complet des fiches clients avec rapprochement manuel supervisé, l’export/rectification/effacement RGPD, les contrats avec échéances/renouvellements structurés, la modération opérationnelle des avis, les invitations révocables, les liens documentaires temporaires, la journalisation forensique enrichie et la recette MySQL/OAuth/Stripe avec comptes réels restent à développer ou tester.

Les fournisseurs e-mail/SMS, Stripe live, la publication et la tâche autonome native restent désactivés. Les notifications non connectées ne sont pas présentées comme envoyées. La conformité RGPD, juridique et WCAG 2.2 AA n’est pas certifiée par ces tests.
