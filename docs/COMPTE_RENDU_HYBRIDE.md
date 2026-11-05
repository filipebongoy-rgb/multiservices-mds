# MULTISERVICES MDS — Poursuite des fondations et tarification hybride

5 novembre 2026 · Même application MDS · Brief révisé PROMPT 1/3.

Cette évolution complète les fondations déjà développées ; elle ne crée pas un autre projet. L’identité, les trois espaces, les permissions, les documents chiffrés, le catalogue validé par MDS et le moteur de double validation sont conservés. Le nouveau brief est enregistré dans `docs/brief-hybride-prompt1.txt`. La version se consulte dans Preview ; elle n’a pas été publiée.

## 1. Tarification hybride définitive

L’administration propose maintenant deux modes explicites : **Mode A — prix affiché** et **Mode B — devis personnalisé**. L’artisan peut changer de mode pour une prestation. Le passage sur devis conserve les anciennes valeurs de configuration pour un éventuel retour au forfait, mais ne les affiche pas comme prix applicable et ne les utilise pas comme un montant ferme.

Pour le prix affiché, MDS configure le prix de prestation, ce qui est inclus, ce qui n’est pas inclus, les frais de déplacement, la durée indicative, les conditions et la zone. L’activation impose les informations indispensables au prix affiché. Une modification réinitialise la confirmation de validation de l’artisan. Aucune prestation ou qualification n’est activée automatiquement.

Les déplacements peuvent être explicitement inclus, fixes ou définis par préfixe de code postal. Une valeur de zéro est une décision explicite de MDS, pas un défaut inventé. En présence de plusieurs règles applicables, le préfixe le plus précis est retenu. Les doublons de préfixe sont refusés. Le mode initial « non configuré » ne suppose pas un déplacement gratuit.

Le total est calculé **en centimes entiers**, depuis les règles administrateur : prix de prestation plus déplacement applicable. Les saisies de montants dans l’administration acceptent virgule ou point et sont converties sans arrondi flottant. Le calcul commun est utilisé pour la présentation et recalculé par le serveur, qui demeure l’autorité.

Si le code postal n’a pas de règle de déplacement, ou si le déplacement n’est pas validé, aucun total ferme n’est annoncé : la demande reste possible sur devis. Avant l’adresse, le prix de base éventuellement présenté est clairement distinct d’un total ferme. Pour une demande libre ou sur devis personnalisé, le calcul ne fournit pas de prix applicable inventé. Le montant du devis doit être renseigné explicitement par MDS et lié à un vrai document.

Les offres du catalogue réel affichent leurs conditions de prix, inclusions, exclusions, déplacement, durée et zone. Les photos de prestation sont facultatives. Le catalogue demeure vide d’offres ouvertes tant que MDS n’a pas validé ses prestations ; les 34 prestations initiales de configuration restent inactives.

## 2. Le tarif annoncé reste traçable

Avant le dépôt d’une prestation sélectionnée, le récapitulatif appelle une API de calcul serveur et reçoit le détail du prix avec son empreinte. Le dépôt exige que cette empreinte corresponde encore aux règles de la prestation et au code postal. Si les conditions ont changé, le serveur refuse l’envoi **avant toute création de client ou demande** et demande de relire le tarif. Le brouillon est conservé ; le consentement doit être renouvelé après mise à jour des conditions.

Le dossier conserve un instantané du mode, des inclusions/exclusions, des règles, du montant annoncé, du déplacement, de la durée, des conditions et de la version tarifaire. Les révisions ultérieures du catalogue ne modifient pas ces anciens dossiers. L’historique des tarifs ferme la version antérieure et conserve la nouvelle configuration complète.

Une proposition ou acceptation simple ne peut pas ajouter silencieusement un montant au forfait annoncé. Un changement de prix passe par **un nouveau devis réel**, une acceptation du devis par le client, puis une confirmation du rendez-vous distincte. Une nouvelle demande sur devis ne peut pas contourner ce chemin en saisissant simplement un prix dans une acceptation directe.

La double validation demeure inchangée : l’accord MDS ne crée pas un rendez-vous définitif. Le serveur vérifie toujours l’accord client, les conflits de planning, la version du dossier et l’unicité du rendez-vous/intervention. Un retry de dépôt identique réutilise la demande existante, même si le catalogue a changé après le premier dépôt. Les dossiers historiques sans instantané conservent leur parcours explicitement identifié comme historique ; aucun prix ou instantané rétroactif n’est fabriqué.

## 3. Administration et simplicité du parcours

Dans **Espace artisan → Paramètres → Catalogue**, MDS peut administrer le mode, le prix, les frais et les conditions. Les règles postales ont des boutons d’ajout/retrait et des messages de validation explicites. L’aperçu de configuration est identifié comme privé, pas comme une offre fictive ouverte. Les sections secondaires du formulaire sont repliables.

Les dossiers artisan montrent les conditions figées du dépôt. Les actions directes sont désactivées lorsqu’un devis réel accepté est nécessaire. Le montant du devis accepté ne peut pas être modifié hors d’un nouveau devis. Les formulaires restent ouverts après une erreur et conservent la saisie.

Dans le parcours client, la photo est facultative, accessible dans une section repliable sur l’écran de description ; elle n’impose plus un clic d’étape supplémentaire. Le parcours d’une première demande sans données connues conserve des questions progressives, sans compte obligatoire. Le brouillon est conservé dans la session, pas la photo après rechargement.

Pour une organisation authentifiée et un site autorisé, l’adresse et les contacts connus sont préremplis. Les étapes de coordonnées déjà connues peuvent être évitées ; lorsque le contexte le permet et qu’il n’y a pas de question spécifique, le parcours peut se limiter au besoin, au créneau et au récapitulatif. Les informations restent visibles et modifiables avant l’envoi. La demande libre, la dictée selon disponibilité du navigateur et la catégorie « À analyser » sont préservées.

## 4. Fondations de paiement réellement raccordées

Une entité relationnelle de paiements et un registre de déduplication des événements ont été ajoutés. Les paiements sont liés au dossier et à une facture réelle, avec montant, devise, mode, statut, dates et références nécessaires au rapprochement. Aucune donnée de carte, clé Stripe, réponse fournisseur brute ou client secret n’est conservée ou exposée dans l’historique.

La facture émise par l’artisan doit avoir un document réel et un montant provenant du tarif ou devis confirmé dans le dossier. Un montant envoyé depuis le navigateur ou une nouvelle valeur du catalogue ne remplace pas ce montant contractuel. Une ancienne facture sans montant validé ne peut pas déclencher Checkout. Les factures déjà réglées sont protégées contre un nouveau paiement.

L’intégration **Stripe fournie par Manus est configurée en mode test**, et l’API Stripe a répondu à une vérification réelle en lecture seule. Checkout est créé côté serveur pour un dossier autorisé et une facture émise en EUR ; les montants inférieurs à 0,50 € ne déclenchent pas de paiement Stripe. Le lien s’ouvre dans un nouvel onglet avec information du client. Les URL de retour restent sur l’origine du navigateur validée, sans utiliser l’Host interne ni transmettre la clé privée de suivi à Stripe.

La réservation de paiement est durable et réutilise une clé d’idempotence lors d’une concurrence ou d’un timeout. Une erreur ambiguë ne crée pas aveuglément une seconde session. Le réseau Stripe est appelé hors de la transaction métier ; les identifiants nécessaires sont persistés. Une réservation devenue ambiguë ou expirée sans identifiant exige un rapprochement MDS plutôt qu’un nouveau débit automatique.

Le webhook est installé **avant le parseur JSON Express**. Il vérifie la signature sur les octets bruts, les relations de facture/dossier/paiement, les identifiants, le montant, la devise et le mode test/live. L’identifiant d’événement est dédupliqué en base, avec des mises à jour transactionnelles. Un événement tardif d’échec ne peut pas annuler un succès.

**Un essai Stripe réussi ne règle jamais une facture commerciale.** Il apparaît comme essai dans l’historique, sans statut métier « Paiement confirmé », sans libération commerciale et sans possibilité de multiplier les essais réussis pour la même facture. Aucun débit réel n’a été lancé pendant ce développement.

Le code commercial est également prévu : seul un événement signé conforme peut acquitter la facture, passer le dossier à « Paiement confirmé » et écrire son historique/notifications atomiquement. Un versement tardif après annulation, changement de facture ou paiement manuel est conservé pour rapprochement, sans acquittement automatique supplémentaire. L’interface ne confond pas « versement reçu » et « facture acquittée », et ne propose pas un second paiement lorsqu’un versement reçu attend sa prise en compte.

La vérification manuelle reste possible : MDS doit fournir un justificatif de vérification réelle. Elle produit un paiement distinct `manual/offline`, au montant de facture, avec identité du vérificateur et date. Une session Stripe **live** encore en attente ou ayant une tentative échouée mais restant réutilisable bloque cette vérification manuelle afin de limiter le risque de double règlement ; une session de test n’équivaut pas à de l’argent reçu.

La page privée **/paiements** et le suivi du dossier présentent l’historique. Les lignes Stripe nomment explicitement le « montant contractuel réservé » ; elles ne le présentent pas comme le montant effectivement reçu en cas d’écart. Le montant reçu à rapprocher se consulte dans Stripe, sans valeur inventée dans le registre. Le retour ou l’annulation de Checkout ne prouvent jamais un paiement et ne changent aucun statut. Les permissions d’organisation s’appliquent aussi aux paiements : un collaborateur révoqué ne retrouve pas les données par l’auteur historique de la demande ou son token.

## 5. Vérifications effectuées

Le contrôle TypeScript et la compilation de production passent. La dernière suite intégrée comporte **124 tests réussis dans six fichiers**, dont 54 tests tarifaires et 33 tests de paiement. Les tests utilisent une base privée en mémoire et des appels Stripe mockés : ils ne créent ni faux clients, ni factures, ni paiements dans la base gérée.

Les tests vérifient notamment calcul des frais configurés, priorité du préfixe postal, absence de total inventé, changement de mode, instantané immuable, empreinte périmée refusée avant écriture, historique tarifaire, impossibilité de supplément silencieux, vrai devis accepté avant confirmation, facture au montant contractuel, paiement manuel, protection contre les doubles confirmations, droits, idempotence Checkout, signature, montant/devise/mode, déduplication et séparation test/commercial.

Les contrôles HTTP réels ont obtenu : serveur et manifeste de neuf pages disponibles, API de configuration paiement en mode test, calcul d’une demande libre sans prix ferme, historique de compte sans connexion refusé avec HTTP 401, webhook non signé refusé avec HTTP 400. Un test HTTP sur des données synthétiques utilise le vrai vérificateur de signatures SDK ; il ne constitue pas une livraison du webhook depuis le service Stripe réel.

Les captures ont contrôlé en largeur mobile 375 px : demande libre, catalogue, professionnel, accès artisan et paiement. Catalogue et paiement ont également été contrôlés en largeur desktop 1280 px. Aucune fausse offre n’a été activée pour ces captures. Le rendu initial, les labels, les contrôles larges, le focus et l’identité mobile-first sont conservés ; la cible WCAG 2.2 AA ne constitue toujours pas une certification complète.

La migration additive `0003_colossal_power_man.sql` a été inspectée et appliquée. Les colonnes et volumes historiques ont été vérifiés avant/après sans seed d’écrasement. La lecture finale de la base a constaté 34 prestations de configuration, zéro demande, zéro facture, zéro paiement et zéro événement de paiement. Aucun compte artisan n’a été revendiqué pour les tests.

## 6. Ce qui reste à faire et à configurer

MDS doit activer son rôle avec le code privé déjà remis, puis renseigner identité légale, coordonnées, zone, qualifications, capacités, prix, contenus de forfait et conditions réellement proposés. Aucune valeur commerciale n’a été devinée. Les PDF sont contrôlés comme pièces réellement liées au dossier ; leur contenu légal et leur montant ne sont pas vérifiés par OCR.

Le propriétaire doit revendiquer le compte Stripe de test dans **Réglages du projet → Intégrations**, puis effectuer une recette avec ses vrais comptes et dossiers autorisés. Pour un essai Stripe, utiliser uniquement la carte de test `4242 4242 4242 4242`, une date future et un code de test, jamais une carte réelle dans un environnement présenté comme test. La livraison effective du webhook par Stripe et le parcours complet facture/Checkout avec un dossier réel restent à recetter.

L’encaissement commercial nécessite les clés commerciales configurées par le propriétaire et la publication/republication correspondante. Cette livraison ne les active pas. Les remises créant un écart avec la facture, réservations ambiguës, remboursements, litiges et versements inattendus nécessitent un rapprochement dans le Dashboard Stripe ; aucun ajustement financier externe n’est prétendu automatique. Une restriction d’origine publique supplémentaire peut être configurée une fois un domaine réel choisi.

Une revue indépendante a confirmé les mécanismes et identifié deux correctifs appliqués : garde manuelle élargie aux tentatives échouées dont la session reste réutilisable, et libellé du montant réservé distinct du montant reçu. Le premier est couvert par un test de régression.

Le calendrier avancé, l’expiration autonome sans trafic, les e-mails/SMS, les notifications push, les cycles contractuels, l’interface complète de modération et l’ouverture commerciale restent à poursuivre. Les limites de conservation/suppression physique des pièces, d’anti-abus, de supervision et de recette de sécurité du rapport initial demeurent. Aucun diagnostic IA n’est inventé ; une suggestion IA de catégorie est facultative et n’a pas été ajoutée.

Les règles, API, migrations, tests et décisions sont dans le même projet pour le PROMPT 2/3. Cette version apporte des fondations opérationnelles supplémentaires et clairement identifiées, pas une simulation de paiement ou une promesse de mise en service commerciale complète.
