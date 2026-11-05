# Simplification UX MDS

## Parcours client

Le chemin nominal suit cinq écrans guidés :

1. **Service** : plomberie, électricité, chauffage, peinture, petits travaux ou besoin non identifié.
2. **Problème** : la liste dépend du métier choisi ; une demande libre reste possible.
3. **Adresse** : adresse, code postal et ville.
4. **Disponibilité** : date et créneau facultatifs, avec proposition de créneaux lorsqu’ils sont disponibles.
5. **Envoi** : récapitulatif, coordonnées et consentement avant transmission.

Depuis l’accueil, l’utilisateur choisit son métier en un clic. Depuis un métier déjà choisi, il arrive directement à l’écran des problèmes, sans détour par le catalogue. Les photos initiales sont sélectionnées en une seule opération, avec aperçu et retrait individuel.

Les boutons sont masqués ou désactivés tant que l’étape courante n’est pas suffisamment renseignée. Le bouton d’envoi n’apparaît qu’à la validation finale. L’adresse et la disponibilité sont séparées afin que l’utilisateur ne mélange pas le lieu et le créneau.

Le chemin nominal demande quatre passages « Continuer » et un envoi final, hors saisie et choix facultatifs. Les clics réels ont été vérifiés dans le navigateur Sandbox : choix Plomberie, choix Fuite, passage à Adresse, passage à Disponibilité, puis passage à Validation.

## Suivi

Le suivi conserve une seule page privée. Une frise permanente présente : Demande reçue → Confirmée → En intervention → Terminée. Les détails, l’historique et les documents restent accessibles dans la même page mais ne concurrencent pas la progression principale.

## Limites conservées volontairement

Les confirmations contractuelles et tarifaires restent nécessaires lorsqu’une véritable décision financière ou de planning est demandée. Elles ne sont pas supprimées pour donner une illusion de rapidité. Aucun paiement réel, transfert ou validation implicite n’est déclenché par l’absence de réponse.

## Validation technique

Le typage, les 259 tests métier et le build de production passent après la refonte. La base de données n’a pas été modifiée pour cette simplification UX. Les routes publiques déclarées répondent également en HTTP 200 dans la Preview.
