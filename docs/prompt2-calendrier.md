# Calendrier opérationnel — PROMPT 2/3

## Contrat exact pour le moteur des demandes

`server/mds/calendar.ts` exporte :

```ts
export async function checkCalendar(
  tx: SqlDb,
  times: { startAt: Date; endAt: Date },
  request: Pick<MdsRequest, "id" | "postcode">
): Promise<{ travelMinutes: number; bufferMinutes: number }>;
export const calendarRouter;
```

Import moteur : `import { checkCalendar } from "./calendar"`. Dans la transaction de confirmation, **après `principal(tx, true)`**, appeler `const margins = await checkCalendar(tx, times, request)` puis enregistrer `.values({requestId: request.id, ...times, ...margins, status: "confirmed"})`. Garder le verrou de l’artisan unique jusqu’au commit. Les propositions, accords MDS et requêtes de créneaux ne créent pas de rendez-vous. La réservation réelle reste postérieure aux deux accords ; la concurrence doit rester sérialisée par le moteur existant.

Intégration parent : importer `calendarRouter` dans le routeur MDS et ajouter `calendar: calendarRouter`. Le frontend utilise directement `trpc.mds.calendar`, sans `as any`. Aucune modification de requests, schéma, validations partagées, routeur racine, CSS global ou base simulée n’a été effectuée par ce lot.

## API

`get` est réservé à l’artisan principal authentifié. Il restitue `settings`, les périodes de cet artisan et les rendez-vous réels non annulés avec uniquement : id, requestId, reference, name, address, postcode, startAt, endAt, status, travelMinutes, bufferMinutes. Aucun token, hash, email ou téléphone n’est exposé.

`saveSettings` utilise `calendarSettingsSchema`, avec horaires **et** zones obligatoires avant activation. Les réglages et les périodes sont journalisés. Les mutations utilisent le même verrou principal que les confirmations.

`savePeriod` reçoit `{id?, startAt, endAt, kind: "available" | "blocked", note}` avec dates ISO à offset explicite, durée croissante de 366 jours maximum et note privée limitée à 1 000 caractères. Modifier/supprimer exige la possession de l’id. Un blocage chevauchant un rendez-vous confirmé, en cours ou terminé, y compris son déplacement et sa marge enregistrés, est refusé : annuler d’abord le rendez-vous si nécessaire. Aucun rendez-vous n’est annulé automatiquement.

`removePeriod` reçoit `{id}`. `slots` est public et reçoit `{serviceId: number | null, postcode: string, date: "YYYY-MM-DD" | "YYYYMMDD", durationMinutes?: number}`. Il renvoie exclusivement `{configured, slots: [{startAt: ISO, endAt: ISO}], reason}`. Les créneaux sont calculés au pas local de 15 minutes, futurs, bornés par l’horizon et limités à 12. Les demandes libres restent sans créneau, même avec durée fournie : MDS évalue leur durée. Seules les prestations actives et non supprimées sont utilisables ; une durée inférieure à celle du catalogue est refusée.

## Règles de disponibilité

La zone au préfixe postal le plus long fournit le temps de trajet avant intervention. Une marge de sécurité suit l’intervention. Toute l’occupation — trajet, prestation, marge — doit tenir dans les horaires ou les périodes disponibles explicites. Ces périodes peuvent ouvrir exceptionnellement hors horaires ; les périodes bloquées ont toujours priorité. Des plages contiguës sont fusionnées, mais un véritable intervalle de fermeture n’est pas traversable.

Les collisions comparent l’occupation complète des **deux** rendez-vous. Les statuts confirmed, in_progress et completed occupent le calendrier ; cancelled n’occupe rien. Les limites exactement contiguës ne se chevauchent pas. Les anciennes marges nulles/absentes valent zéro et ne reçoivent pas rétroactivement la configuration actuelle.

Par défaut : calendrier désactivé, aucun horaire ni zone inventés. Les demandes et confirmations manuelles existantes restent possibles avec le contrôle historique des blocages/rendez-vous et des nouvelles marges à zéro. Les marges déjà enregistrées sur un rendez-vous restent utilisées pour éviter les conflits, même après désactivation du calendrier public.

Modifier horaires, zones, horizon, marge ou supprimer une disponibilité ne réécrit jamais les rendez-vous existants. La sauvegarde précise explicitement son effet non rétroactif ; seules les nouvelles confirmations appliquent la nouvelle configuration.

## Fuseau et changement d’heure

Le calcul serveur et la saisie privée utilisent Europe/Paris via `Intl.DateTimeFormat`, indépendamment du fuseau du serveur/navigateur. Une heure locale est convertie seulement lorsqu’un unique instant UTC correspond exactement aux composants demandés. Les heures locales inexistantes au printemps et ambiguës à l’automne sont refusées, y compris lors d’une confirmation envoyée en UTC. Les bornes d’horaires qui ne peuvent être résolues de manière unique ne créent pas de disponibilité. Aucun ajout de dépendance.

## Interface artisan simplifiée

Conformément à `docs/brief-refonte-ux.txt` et à la consigne parent : trois entrées seulement — **Demandes**, **Planning**, **Interventions**. Demandes est l’entrée initiale, avec résumé compact dossiers/rendez-vous du jour et notifications repliées. Interventions filtre les dossiers à réaliser/en cours et terminés, puis ouvre le même `RequestDetail` que les demandes : documents, devis, factures, incidents et paiements restent contextuels au dossier.

Planning offre Jour/Semaine, Aujourd’hui, Précédent/Suivant et sélection de date. La liste est groupée par journée, à l’heure de Paris, à partir des rendez-vous réels uniquement. Les outils horaires/zones et périodes ponctuelles sont repliés dans un panneau adjacent qui passe sous la liste sur petit écran. Les brouillons restent conservés lors des changements de date, refetch et fermeture des détails ; aucune synchronisation aveugle d’une réponse serveur n’efface la saisie en cours. Libellés visibles, navigation clavier native, actions de 44 px minimum, notifications de succès et erreurs accessibles.

Les paramètres métier existants et `AutomationSettings` du parent sont accessibles dans les détails Paramètres MDS du Planning, pas dans une quatrième entrée de navigation. Aucune nouvelle page ni client fictif.

## Vérifications et limites

`pnpm exec vitest run server/mds/calendar.test.ts` : **26 tests réussis** à la dernière exécution. Couverture : horaires matin/soir, fermetures, trajets, marges, préfixes, créneaux non réservés, catalogue actif, demande libre, passé/horizon, collisions des statuts occupés, compatibilité désactivée, non-rétroactivité, priorité des blocages, propriété des périodes, autorisations artisan, journal et transitions été/hiver. Quatre tests supplémentaires couvrent les confirmations concurrentes sous verrou, les propositions identiques qui ne réservent rien, le filtrage public sans divulgation privée et les ouvertures exceptionnelles d’un jour sans horaires.

Les tests utilisent exclusivement `MockDatabase`; aucune écriture de production, navigation navigateur, login, message fournisseur, commit, push ou publication. **`pnpm check` réussit** après le raccordement parent du routeur calendrier et des autres modules. Le raccordement du moteur des demandes est également présent : le retour des marges est récupéré lors de la confirmation transactionnelle. Le parent doit encore valider les tests métier globaux et le build après les derniers changements parallèles.

Limites assumées : pas de calcul cartographique ni trafic temps réel ; les temps de trajet sont les minutes explicitement configurées par zone. Une consultation de créneaux ne constitue ni réservation, ni garantie jusqu’au recontrôle transactionnel de confirmation. Le planning privé est une liste hebdomadaire/journalière accessible, sans glisser-déposer ni annulation implicite.
