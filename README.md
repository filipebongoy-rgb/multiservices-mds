# MULTISERVICES MDS

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

## Reprendre le développement avec Claude

Le fichier `CLAUDE.md` contient le contexte technique, les routes importantes et les règles métier à respecter. Dupliquer `.env.example` en `.env`, renseigner uniquement les secrets dans l’environnement local ou dans les secrets du déploiement, puis lancer `pnpm check`, `pnpm test` et `pnpm dev`.

Le dépôt GitHub doit rester privé par défaut. Ne jamais ajouter `.env`, les clés Stripe/Twilio/Resend, un export de base de données ou des données clients dans Git. Les dossiers clients et les données de production restent dans la base MDS ; GitHub contient uniquement le code et les migrations.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.
