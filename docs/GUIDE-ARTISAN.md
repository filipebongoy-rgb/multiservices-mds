# MULTISERVICES MDS — Guide d’utilisation artisan

Ce document répond aux questions concrètes de l’artisan sur le fonctionnement quotidien de l’application.

---

## 1. Comment l’artisan se connecte

- Rendez-vous sur le site MDS, cliquez sur **Mon espace** (en haut à droite sur ordinateur, dernier onglet en bas sur mobile).
- Le compte artisan a été préconfiguré pour **ife369243@gmail.com** (profil : Ngoyone, rôle admin).
- Lors de la première connexion, utilisez ce même e-mail : le système vous reconnaît automatiquement et ouvre votre espace artisan avec tous les outils.

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

Toutes les demandes arrivent sur le **compte artisan unique** (Ngoyone, admin). MDS n’a **qu’un seul artisan** : aucune demande n’est dispatchée ou partagée. Vous les voyez toutes.

### Pourquoi elles ne sont plus oubliées ?

- **Ordre de priorité automatique** : les demandes à analyser apparaissent *avant* celles qui attendent le client, et *avant* les interventions confirmées.
- **Bannière d’alerte permanente** : si des demandes restent à traiter, un message rouge le rappelle à chaque ouverture de l’application.
- **Horloge d’attente** : chaque demande affiche sa date/heure de réception pour voir facilement ce qui a été déposé il y a longtemps.

---

## 3. Comment la demande s’affiche sur votre écran

Depuis l’espace artisan, deux vues :

### Vue « Demandes » (votre tableau de bord)

- **Colonne de gauche** : la liste des demandes reçues, triées par urgence, avec le nom du client, la prestation demandée, la ville et la date.
- **Cliquez sur une demande** : la colonne de droite ouvre le **dossier complet**.
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

- Téléphone MDS : **07 53 82 49 51**
- E-mail MDS : **ife369243@gmail.com**
- Adresse de l’application : `https://mdsservices-73dc9ex8.manus.space` (publiée automatiquement)

---

## 10. Checklist quotidienne

- [ ] Matin : ouvrir l’onglet **Demandes**, traiter les « Action requise » en premier.
- [ ] Consulter l’onglet **Aujourd’hui** pour la tournée du jour.
- [ ] Sur la route : cliquer **« Démarrer le trajet »** (votre téléphone partage sa position).
- [ ] Arrivé : cliquer **« Je suis arrivé »**, puis **« Commencer »**.
- [ ] Pendant/après : ajouter au moins une photo **après travaux**.
- [ ] Cliquer **« Terminer »**, faire **signer le client** sur l’écran.
- [ ] Soir : un coup d’œil à l’onglet **Activité** pour vérifier connexions, demandes et paiements.
