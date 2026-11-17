# Continuer MULTISERVICES MDS avec Claude

## Démarrage rapide

```bash
pnpm install
cp .env.example .env
pnpm check
pnpm test
pnpm dev
```

Le serveur de développement écoute sur le port `3000` par défaut. L’application utilise React, Vite, Express, tRPC, Drizzle ORM, MySQL et wouter.

## Architecture

- `client/src/pages/` : pages publiques, client, professionnel et artisan.
- `client/src/components/mds/` : composants métier MDS et espace privé artisan.
- `server/mds/` : routeurs et règles métier côté serveur.
- `server/_core/` : démarrage Express, authentification, configuration et stockage.
- `shared/` : schémas et types partagés entre client et serveur.
- `drizzle/` : schéma MySQL et migrations.
- `scripts/` : seed, prérendu et opérations de maintenance.

## Routes importantes

- `/` : accueil client.
- `/prestations` : catalogue des prestations.
- `/demande` : dépôt d’une demande client.
- `/suivi` : suivi privé d’une demande.
- `/professionnels` : offres et espace organisations.
- `/portfolio` et `/reseau` : acquisition publique.
- `/artisan/assistant` : assistante opérationnelle.
- `/artisan/demandes` : demandes artisan.
- `/artisan/planning` : agenda hebdomadaire.
- `/artisan/interventions` : interventions actives.
- `/artisan/settlements` : règlements.
- `/artisan/team` : collaborateurs.

Les dossiers artisan doivent rester sur des pages dédiées : `/artisan/requests/:id` et `/artisan/interventions/:id`. Ne pas revenir à une liste interminable avec détail sous la liste.

## Règles métier non négociables

1. Une intervention ne peut pas être terminée sans au moins une photo réelle après travaux enregistrée côté serveur.
2. Une signature tactile du client est requise à la fin du chantier.
3. Le paiement reste séparé de la clôture : l’assistante ne libère jamais les fonds uniquement parce qu’une photo existe.
4. Les paiements Stripe et les webhooks doivent être testés avant toute modification de production.
5. Les demandes actives et les interventions terminées ne doivent jamais être mélangées dans les listes.
6. Les clients, professionnels, artisans, collaborateurs et administrateurs ont des accès séparés.
7. Les informations privées de dossiers ne doivent jamais apparaître dans le HTML public, le sitemap ou les métadonnées SEO.
8. L’assistante peut préparer des devis et des actions à partir de données structurées, mais elle ne doit pas inventer un prix, un créneau ou une information client. Les prestations sans prix confirmé restent sur devis après analyse.
9. Les appels téléphoniques réels restent désactivés tant que les identifiants Twilio, le numéro et les règles de consentement ne sont pas configurés.
10. Toute modification de données de production doit être idempotente et ne doit pas supprimer les dossiers clients sans confirmation explicite.

## Catalogue

Le catalogue actuel contient 69 prestations actives. Le script idempotent `scripts/seed-flyer-data.ts` peut mettre à jour les prestations tarifées et ajouter les nouvelles prestations. Les prestations sans prix réel utilisent `pricingMode: "quote"` et `priceCents: null`.

Ne pas transformer automatiquement une prestation sur devis en prix fixe. Toute nouvelle tarification doit être validée dans le catalogue et couverte par les tests de tarification.

## Assistante

Les principaux fichiers sont :

- `client/src/components/mds/private-assistant.tsx`
- `server/mds/assistant.ts`
- `server/mds/automation.ts`

L’assistante doit rester simple pour un artisan peu habitué à la technologie : une action principale, des libellés courts, des liens directs vers le dossier et aucun faux état « envoyé » ou « terminé ».

## Paiements et abonnements

Le projet contient Stripe pour les paiements et les abonnements professionnels. Les clés et secrets ne doivent jamais être commités. Utiliser uniquement les variables de `.env` ou les secrets du fournisseur de déploiement. Ne pas lancer de paiement réel sans confirmation explicite du propriétaire.

## Vérifications avant commit

```bash
pnpm check
pnpm test
pnpm build
```

Puis vérifier :

```bash
git diff --check
git status --short
```

## Publication

Le dépôt Git est la source de vérité. Ne jamais supprimer ou réinitialiser l’historique sans confirmation. Les secrets de production ne sont pas stockés dans GitHub. Pour le déploiement MDS, utiliser le mécanisme de publication du projet après validation du build.
