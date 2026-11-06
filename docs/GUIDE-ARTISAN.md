# MULTISERVICES MDS — Guide d’utilisation artisan

Ce document répond aux questions concrètes de l’artisan sur le fonctionnement quotidien de l’application.

---

## 1. Comment l’artisan se connecte

- **Rendez-vous sur le site MDS** (`https://mdsservices-73dc9ex8.manus.space`) et cliquez sur **Mon espace** (en haut à droite sur ordinateur, dernier onglet en bas sur mobile).
- **Les comptes administrateurs autorisés** sont **ife369243@gmail.com**, **multiservicesmds2026@gmail.com** et **filipe.bongoy@gmail.com**. Pour les deux nouvelles adresses, ouvrez une première fois la connexion avec l’identité correspondante : MDS les reconnaît automatiquement comme administrateurs complets. Aucun mot de passe n’est partagé.
- La redirection après connexion vous amène automatiquement sur l’espace artisan ; vous pouvez ensuite naviguer librement vers le site public grâce au lien « Voir le site public → ».

---

## 2. Comment l’artisan reçoit les demandes

### Le trajet d’une demande

1. **Le client remplit le formulaire** sur le site (ou depuis son suivi).
2. **La demande est enregistrée immédiatement** dans la base de données.
3. **À la seconde même**, le système :
   - envoie une **notification push propriétaire** qui fait sonner/vibrer le téléphone (via le canal de notification de la plateforme),
   - crée une **alerte dans l’application** (cloche en haut de l’écran, avec badge non lu),
   - place le dossier tout en haut de la liste avec l’étiquette **« Action requise »**,
   - affiche un **bandeau rouge clignotant** sur l’accueil artisan tant qu’une demande attend une réponse.

### À quel compte arrivent les demandes ?

Toutes les demandes arrivent dans l’**espace MDS partagé par les administrateurs autorisés**. MDS conserve un seul artisan et une seule activité, mais plusieurs administrateurs peuvent traiter les mêmes dossiers sans créer une marketplace.

### Pourquoi elles ne sont plus oubliées ?

- **Ordre de priorité automatique** : les demandes à analyser apparaissent *avant* celles qui attendent le client, et *avant* les interventions confirmées.
- **Bannière d’alerte permanente** : si des demandes restent à traiter, un message rouge le rappelle à chaque ouverture de l’application.
- **Horloge d’attente** : chaque demande affiche sa date/heure de réception pour voir facilement ce qui a été déposé il y a longtemps.

---

## 3. Comment la demande s’affiche sur votre écran

Depuis l’espace artisan, deux vues :

### Vue « Demandes » (votre tableau de bord)

- **Sur ordinateur** : deux colonnes — à gauche la liste des demandes reçues (triées par urgence), à droite le dossier sélectionné.
- **Sur mobile** : affichage en pleine page. Cliquez sur un dossier (ou son indicateur orange « Ouvrir ») pour voir la fiche complète, puis sur le bouton **« Retour à la liste des demandes »** en haut pour revenir à la liste.
- **Badge orange « Action requise »** sur les nouvelles demandes (« À analyser », « À préciser ») pour ne rien rater.
- Le dossier contient :
  - le problème décrit par le client et ses réponses aux questions,
  - ses photos (s’il en a jointes),
  - son adresse avec le code postal,
  - son téléphone (cliquable pour appeler directement),
  - son e-mail,
  - la date et l’heure de réception,
  - le créneau qu’il a souhaité.

### Vue « Aujourd’hui »

- Les rendez-vous du jour heure par heure.
- Pratique le matin pour voir sa tournée.

---

## 4. Comment l’artisan répond rapidement à une demande

Ouvrez le dossier, vous disposez des boutons suivants :

| Action | Quand l’utiliser | Ce que le client reçoit |
|---|---|---|
| **Accepter** | Le créneau et le prix vous conviennent | Notification « MDS a accepté votre demande », créneau bloqué provisoirement |
| **Autre créneau** | Le créneau proposé ne va pas | Nouvelle proposition avec le choix d’une autre date/heure |
| **Soumettre un devis** | Prix à préciser avant de confirmer | Notification avec le montant du devis à accepter |
| **Demander des précisions** | Manque d’informations | Notification l’invitant à répondre dans son suivi |
| **Demander une photo** | Besoin d’une photo de la fuite/panne | Demande formelle de photo, envoyée au client |
| **Organiser un diagnostic** | Devis sur place nécessaire | Proposition de rendez-vous de visite |
| **Refuser** | Hors zone, impossibilité | Notification polie de refus avec possibilité d’explication |

> **Règle d’or : une réponse ne confirme jamais un rendez-vous définitif.**
> C’est seulement lorsque le client confirme à son tour que le rendez-vous devient définitif (double validation).

---

## 5. Comment l’artisan reçoit les notifications

Trois canaux, selon votre usage :

1. **La cloche dans l’application** (en haut à droite, y compris sur mobile) : liste toutes les alertes reçues, avec compteur non lu.
2. **Notification push propriétaire** : envoyée à chaque nouvelle demande ou action client, visible même si l’application est fermée (sur le téléphone associé au compte plateforme).
3. **E-mail de contact** : les coordonnées publiques affichent `ife369243@gmail.com` pour que les clients puissent aussi écrire directement.

---

## 6. L’administration : connexions, demandes, paiements

L’onglet **« Activité »** de l’espace artisan fournit une vue de supervision complète :

- **Indicateurs clés** : nombre total de demandes, demandes en attente, confirmées, en cours, terminées, nombre de clients uniques (adresses e-mail différentes), chiffre d’affaires encaissé (somme des paiements réussis).
- **Dernières connexions** : qui s’est connecté et quand (dernière connexion de chaque utilisateur enregistré).
- **Dernières demandes** : liste complète avec nom, téléphone, e-mail, ville, prestation, statut et date.
- **Paiements** : chaque paiement avec son statut (réussi, échoué, annulé), son montant, et **le motif exact de l’échec** quand il y en a un (ex. : « carte refusée par la banque »).

---

## 7. La zone d’intervention : Rennes + 30 km

- L’artisan est basé à **Rennes** (35000).
- La zone enregistrée dans le système est : **« Rennes et son agglomération — interventions jusqu’à 30 km aux alentours (Ille-et-Vilaine) »**.
- Le calendrier public pré-sélectionne le code postal **35000** pour filtrer les créneaux disponibles.
- Cette zone s’affiche sur les devis, dans les paramètres publics et dans l’onglet Activité.

---

## 8. Le déroulement d’une intervention

Pendant la journée d’intervention, tout se passe depuis le dossier :

```
Demande confirmée → Démarrer le trajet → Je suis arrivé → Commencer l’intervention
                         ↓                     ↓
                    GPS activé           GPS arrêté
                    carte client        « Artisan arrivé »
                    notif départ         notif arrivée
                                             ↓
                                      Photos obligatoires
                                             ↓
                                  Terminer l’intervention
                                             ↓
                               Signature client sur l’écran
                                             ↓
                                 Validation & paiement
```

**Règles importantes :**

- **« Je suis arrivé »** n’est accepté que si vous êtes à moins de 500 mètres de l’adresse (contrôle GPS réel).
- **« Terminer l’intervention »** est bloqué tant qu’au moins **une photo après travaux** n’a pas été ajoutée au dossier.
- À la fin, tendez votre téléphone au client : **« Faire signer le client sur cet écran »** ouvre un pavé de signature où le client signe avec son doigt. La signature est chiffrée, horodatée et conservée comme preuve.
- Le client peut aussi valider et signer depuis **son propre suivi**.
- Le règlement de l’artisan n’intervient **qu’après cette validation** (les fonds restent bloqués chez le prestataire de paiement jusque-là).

---

## 9. Contacts utiles

- Téléphone officiel MDS (affiché aux clients) : **06 04 15 99 16**
- Téléphone propriétaire MDS : **07 53 82 49 51**
- E-mail officiel : **contact@multiservices-mds.fr**
- E-mail de connexion artisan : **ife369243@gmail.com**
- Adresse de l’application : `https://mdsservices-73dc9ex8.manus.space` (publiée automatiquement)

---

## 10. Comment donner l’accès aux futurs collaborateurs

### Administrateurs complets

Les deux nouvelles adresses ont été préautorisées dans MDS. Elles doivent utiliser leur propre identité de connexion ; au premier accès OAuth, leur compte est créé puis promu automatiquement. Chaque action reste associée à la personne réellement connectée.

Cette autorisation concerne un administrateur complet, pas un collaborateur opérationnel. Ne partagez jamais un identifiant existant. Le futur module collaborateurs devra utiliser des comptes séparés, des affectations de dossiers et des droits limités aux actions terrain.

---

## 11. Checklist quotidienne

- [ ] Matin : ouvrir l’onglet **Demandes**, traiter les « Action requise » en premier.
- [ ] Consulter l’onglet **Aujourd’hui** pour la tournée du jour.
- [ ] Sur la route : cliquer **« Démarrer le trajet »** (votre téléphone partage sa position).
- [ ] Arrivé : cliquer **« Je suis arrivé »**, puis **« Commencer »**.
- [ ] Pendant/après : ajouter au moins une photo **après travaux**.
- [ ] Cliquer **« Terminer »**, faire **signer le client** sur l’écran.
- [ ] Soir : un coup d’œil à l’onglet **Activité** pour vérifier connexions, demandes et paiements.
