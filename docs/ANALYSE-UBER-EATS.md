# Le système Uber Eats appliqué à MULTISERVICES MDS

Uber Eats ne repose pas sur un écran spectaculaire. Sa force vient d'une suite d'étapes courtes, toujours dans le même ordre. Le client ne cherche jamais où en est sa commande. C'est l'application qui la lui montre. Ce document décrit ces mécanismes et indique comment MDS les reprend, sans copier la marque, le logo ni la charte graphique d'Uber.

## 1. Une seule question au départ

La page d'accueil française d'Uber Eats tient en une phrase et une action. Elle affiche « Vos restos locaux livrés chez vous », demande l'adresse de livraison et propose un seul bouton principal [1]. Les autres publics (entreprises, restaurants, coursiers) sont renvoyés vers des liens secondaires plus bas dans la page [1].

**Dans MDS.** L'accueil pose une seule question : « Que souhaitez-vous faire réparer ? ». Il propose un seul bouton principal, « Faire une demande ». L'espace professionnel reste un accès secondaire, comme le compte professionnel chez Uber.

## 2. La commande en cours toujours visible

Pour suivre sa commande, le client ouvre l'application et appuie sur la bannière verte en haut de la page d'accueil [2]. S'il a plusieurs commandes, il choisit celle qu'il veut suivre [2]. On accède aussi au suivi par l'icône des reçus de la barre de menu du bas, puis par « Suivre la commande » [3].

**Dans MDS.** Un bandeau « Intervention en cours » apparaît en haut de l'accueil dès qu'un dossier est actif. Il mène directement au suivi. L'onglet « Mes demandes » de la barre du bas joue le rôle de l'icône des reçus. Il sépare les demandes « En cours » et « Terminées », avec un bouton « Suivre » sur chaque carte.

## 3. Une phrase qui explique le statut

L'aide d'Uber demande au client de lire la description affichée pour comprendre le statut de sa commande [2]. Le statut est donc expliqué par une phrase, pas par un code interne.

**Dans MDS.** Chaque statut du dossier est traduit en une phrase simple, par exemple « Votre demande est bien reçue » ou « Votre artisan est arrivé ». Elle est accompagnée de la prochaine étape attendue.

## 4. La carte n'apparaît qu'au départ du livreur

La position du coursier n'est visible sur la carte qu'une fois celui-ci affecté. Le client suit ensuite sa progression jusqu'à son domicile [2]. Quand le coursier d'un restaurant scanne la commande au départ, le client est prévenu que sa commande est en route et la position est partagée [4]. Si le coursier retire la commande de son application, le partage de position s'arrête immédiatement [4].

**Dans MDS.** La carte Mapbox ne s'affiche qu'après « Démarrer le trajet ». La position vient du GPS réel du téléphone de l'artisan. Le partage s'arrête côté serveur dès que l'artisan déclare son arrivée.

## 5. Contact, proximité et fin de course

Le coursier et le client peuvent se joindre par appel ou par message [4]. Le coursier ne peut marquer la commande comme livrée qu'à environ 100 mètres de l'adresse du client [4].

**Dans MDS.** Le client dispose d'un bouton « Appeler MDS » pendant le trajet. Le serveur refuse « Je suis arrivé » si la position GPS récente place l'artisan à plus de 500 mètres de l'adresse. Le seuil est plus large que celui d'Uber, car l'adresse d'un chantier est souvent moins précise qu'une porte de livraison. Si le GPS a été refusé ou n'est plus à jour, la règle ne bloque pas l'artisan, parce qu'aucune position n'est inventée.

Une notification « Artisan bientôt arrivé » est envoyée une seule fois, quand la position réelle passe à moins d'un kilomètre de l'adresse.

## 6. La photo comme preuve

Uber peut exiger que le coursier photographie la commande au point de livraison, comme preuve de livraison réussie [5]. Uber précise qu'il revient au marchand de montrer cette photo au client dans sa propre application [5].

**Dans MDS.** La règle est plus stricte. Une intervention ne peut pas être déclarée terminée sans au moins une photo « après travaux », et ce contrôle est fait côté serveur. Les photos avant et après sont affichées côte à côte dans le suivi du client.

## 7. Après la commande : noter ou signaler

Après une commande, le client retrouve la commande dans la liste des reçus et appuie sur « Noter la commande » [6]. Pour les autres problèmes, l'aide renvoie vers des cas précis, comme une commande en retard ou jamais arrivée [6].

**Dans MDS.** Les demandes terminées proposent « Voir et noter ». Le client peut confirmer la fin des travaux ou ouvrir une réclamation. Le paiement à l'artisan n'est jamais libéré sur la seule base d'une photo.

## Ce que MDS ne reprend pas

MDS n'utilise ni le nom, ni le logo, ni la couleur verte d'Uber. Le système d'Uber s'applique ici à un seul artisan. Il n'y a ni coursiers multiples, ni restaurants partenaires, ni recommandations sponsorisées.

## References

[1]: https://www.ubereats.com/fr "Uber Eats France - page d'accueil"
[2]: https://help.uber.com/fr-FR/ubereats/restaurants/article/consulter-le-statut-de-ma-commande?nodeId=4148ea8b-c9d8-409d-b7bf-b2fcb019a498 "Uber Eats - Consulter le statut de ma commande"
[3]: https://help.uber.com/fr-FR/ubereats/stores/article/consulter-le-statut-de-ma-commande-?nodeId=fe11879e-0994-4a74-b6d2-4e4889e22b18 "Uber Eats - Consulter le statut de ma commande, menu du bas"
[4]: https://help.uber.com/en/merchants-and-restaurants/article/live-order-tracking---faq?nodeId=d006582e-113f-4423-9d33-e938de34b3a2 "Uber - Live Order Tracking FAQ"
[5]: https://developer.uber.com/docs/deliveries/guides/proof-of-delivery "Uber Developers - Proof of Delivery"
[6]: https://help.uber.com/ubereats/stores/article/i-had-an-issue-with-my-delivery?nodeId=80c0a22a-2781-499c-84f1-fb0e8efb71f8 "Uber Eats - I had an issue with my delivery"
