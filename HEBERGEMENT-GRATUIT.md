# Publier MULTISERVICES MDS gratuitement

Pile gratuite : **Supabase** (base PostgreSQL gratuite) + **Render** (serveur, offre Free) + **cron-job.org** (déclencheur des relances).

## Limites à connaître
- Render Free s'endort après 15 min sans visite et met environ 1 minute à se réveiller. Il offre 750 h par mois, soit un service en continu (744 h).
- Les fichiers écrits sur le serveur sont perdus à chaque redémarrage : la base doit contenir toutes les données.
- Paiements Stripe, e-mails (Resend) et appels (Twilio) restent désactivés tant que leurs clés ne sont pas saisies. Les relances passent alors en « Échec » avec le motif, jamais en « Envoyée ».
- Pas de garantie de disponibilité : pour une activité réelle avec paiements, prévoir à terme une offre payante.

## 1. Base de données (Supabase)
1. Créer un compte sur supabase.com, puis un projet **gratuit**, région Europe. Choisir et noter le mot de passe de la base (ne l'envoyer à personne).
2. Cliquer sur **Connect**, onglet **Transaction pooler**, et copier l'adresse (`postgresql://postgres.xxxx:[MOT_DE_PASSE]@...pooler.supabase.com:6543/postgres`). Remplacer `[MOT_DE_PASSE]` par le vôtre.
3. Garder cette adresse pour l'étape 2. Les tables sont créées automatiquement au démarrage du serveur.
4. Un projet Supabase gratuit est mis en pause après une semaine sans activité : l'appel toutes les 10 minutes de l'étape 3 évite cela.

## 2. Serveur (Render)
1. Créer un compte sur render.com avec GitHub, puis **New → Blueprint** et choisir le dépôt `multiservices-mds` (Render lit `render.yaml`).
2. Quand Render demande `DATABASE_URL`, coller l'adresse de l'étape 1, et dans `MDS_OWNER_EMAIL` votre adresse e-mail.
3. Lancer le déploiement. Au démarrage, les migrations sont appliquées et le catalogue chargé (`MDS_SEED_ON_START=1`).
4. Quand le site répond, ouvrir **Environment** et **supprimer `MDS_SEED_ON_START`**, pour ne pas réécrire les tarifs du catalogue à chaque redémarrage.

## 3. Relances automatiques (cron-job.org)
1. Dans Render, copier la valeur de `MDS_CRON_SECRET`.
2. Sur cron-job.org, créer une tâche : URL `https://VOTRE-SITE.onrender.com/api/scheduled/mds-maintenance`, méthode **POST**, toutes les **10 minutes**.
3. Ajouter l'en-tête `Authorization: Bearer <valeur de MDS_CRON_SECRET>`.

Cet appel exécute les relances échues, et son rythme (moins de 15 min) garde aussi le serveur éveillé.

## 4. Premier accès propriétaire
Le rôle administrateur est donné à la connexion si l'adresse e-mail figure dans la table des invitations. Aucun mot de passe ne doit être envoyé par message.

1. Dans Supabase, ouvrir **SQL Editor** et exécuter (votre adresse en minuscules) :
   `INSERT INTO mds_admin_invites (email, status) VALUES ('votre@adresse.fr', 'active');`
2. Sur le site, créer votre compte avec cette même adresse et votre mot de passe, puis vous déconnecter et vous reconnecter : le compte devient administrateur.
3. Dans Render, cliquer **Manual Deploy → Restart** : le serveur vous désigne propriétaire (`MDS_OWNER_EMAIL`) et active les relances automatiques. Sans ce redémarrage, l'appel du cron répond une erreur.
