# Administration artisan — tarification hybride

## Livraison ciblée

L’espace existant `/artisan` conserve sa connexion réelle et son contrôle du rôle administrateur. Les changements concernent uniquement `client/src/components/mds/private-artisan-settings.tsx`, `client/src/components/mds/private-artisan-requests.tsx` et le nouveau composant `client/src/components/mds/private-pricing.tsx`. Aucun changement dans les pages publiques, `App`, les styles globaux, le serveur, le schéma, les fichiers partagés ou les dépendances.

Dans **Paramètres → Catalogue → Ajouter / Modifier**, le mode A « Prix affiché » dispose d’un prix de base obligatoire, des inclusions et exclusions et des déplacements explicitement inclus, fixes ou par préfixes postaux. Le mode B « Devis personnalisé » conserve le prix de base précédent comme configuration sans l’afficher dans l’aperçu ni l’utiliser pour son calcul. Les nouveaux prix et frais sont vides ; le déplacement reste non configuré jusqu’au choix explicite de MDS. Les règles postales se créent avec deux champs vides, se suppriment individuellement et sont validées par les règles partagées, notamment contre les préfixes dupliqués. La plus longue correspondance postale s’applique ; sans correspondance, le calcul indique un devis nécessaire.

Les valeurs API nulles sont normalisées. Le formulaire envoie exclusivement les propriétés attendues par `serviceSchema`, pas les propriétés de persistance ou de révision. Le prix, les frais et les montants de devis sont convertis par une fonction de saisie décimale exacte : virgule ou point, au plus deux décimales, pas de `Math.round`, de `NaN`, de notation exponentielle ni de montant négatif. Un champ vide n’est pas confondu avec zéro. La confirmation explicite d’activation est réinitialisée après une modification ; en mode A, inclusions, exclusions, conditions non blanches et déplacement configuré sont requis avant activation. Les validations partagées et serveur restent autoritaires.

L’aperçu est clairement nommé **« Aperçu de configuration — pas une offre réelle »**. Il calcule uniquement dans le navigateur, à partir de `calculatePricing`, sans créer de dossier. Les sections secondaires du formulaire sont repliables ; labels visibles, contrôles existants, boutons de 44 px minimum et fenêtre Radix sont conservés.

Dans **Demandes → Dossier**, un instantané affiche le mode, la révision, la prestation, le code postal, la base, le déplacement, le total et le périmètre/conditions conservés au dépôt. Aucun ancien montant de base conservé en mode devis n’est présenté comme un prix ferme. Les conditions d’origine ne sont pas remplacées par celles du catalogue courant. Les anciens dossiers sans instantané sont identifiés explicitement et conservent leur parcours historique.

Une demande nécessitant un devis, ou ayant un devis en attente/refusé, ne peut pas être acceptée directement ni recevoir une autre proposition de créneau avant l’acceptation du devis. L’action **Devis** conserve le vrai dépôt PDF existant et le contrôle serveur empêchant de réutiliser un devis déjà soumis. Hors nouveau devis, les nouveaux dossiers utilisent le total figé de leur instantané ; après acceptation d’un devis, son montant accepté est conservé. Le champ de prix est en lecture seule et le montant envoyé provient des données autoritaires du dossier. Une nouvelle portée ou un nouveau montant nécessite un nouveau devis PDF et son acceptation distincte.

L’action facture ne permet aucune saisie de supplément : le montant applicable est calculé par le serveur. La confirmation manuelle de paiement garde le justificatif obligatoire et précise qu’un paiement test n’est pas une preuve d’argent reçu. Les champs saisis dans les formulaires restent en mémoire après un rejet de mutation ; les conflits provoquent une relecture de la version autoritaire sans réinitialiser le formulaire ouvert.

## Procédures utilisées

Les écrans réutilisent `mds.catalog.list`, `mds.catalog.save`, `mds.catalog.remove`, `mds.settings.get/save` et `mds.audit.list`. Le dossier réutilise `mds.requests.detail`, `mds.requests.artisanAction`, `mds.documents.upload/download`, les invalidations des rendez-vous et notifications, ainsi que les évaluations privées existantes. Aucune nouvelle route ou procédure n’a été créée.

## Vérifications réalisées

- `pnpm check` : TypeScript passe sur le projet, après l’intégration des types backend d’instantané.
- Assertions locales en mémoire : aller-retour centimes/euros (dont zéro et un centime), virgule/point, rejet des valeurs invalides et hors limite, préfixe postal le plus précis, repli sur devis pour code non couvert ou frais non configurés, rejet des doublons et des règles incomplètes, refus d’un prix fixe absent.
- Rendu React serveur des composants privés : mention d’aperçu de configuration, prix précédent absent du rendu de l’instantané sur devis et absent du champ de prix de l’éditeur en mode B.
- Lecture du contrôle d’accès `/artisan` et du contrôle contractuel backend : aucune connexion fictive, écriture DB de test, soumission PDF de test ou confirmation de paiement effectuée.

Le parcours administrateur authentifié n’a pas été exécuté dans un navigateur, pour ne pas créer de faux dossiers ou modifier la configuration partagée. Les assertions utilisent seulement des objets en mémoire clairement dédiés à la vérification. Aucun commit ni push effectué.

### État du dernier contrôle global pendant le développement parallèle

Le premier `pnpm check` a réussi. Le contrôle relancé le 5 novembre 2026 à 11 h 19 a ensuite rencontré six erreurs hors périmètre administratif, pendant l’ajout parallèle des paiements : `client/src/components/mds/PaymentPanel.tsx` (procédure `mds.payments` absente aux lignes 31, 32, 36 et type du paramètre `record` ligne 175) et `client/src/pages/Payments.tsx` (procédure absente ligne 29 et type du paramètre `record` ligne 106). Aucun des trois composants artisan n’est signalé. Le routeur de paiement doit être raccordé par son responsable, puis le contrôle global relancé ; ces fichiers n’ont pas été modifiés dans cette livraison.
