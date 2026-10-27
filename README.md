# Drip Café Operations — GitHub source export

This archive contains the application source from commit `1df3f4a` (React, Vite, Express, tRPC, Drizzle/MySQL, UI, and migrations). It is a **source export, not a ready-to-deploy Vercel package**.

## Vercel readiness

The application currently targets the Manus runtime. Authentication uses Manus OAuth/session APIs, and persistence expects a MySQL-compatible `DATABASE_URL`. The archive contains no Manus credentials, OAuth tokens, `.env` file, or database dump. The demo records currently in the Manus-managed database are **not** included.

There is no Vercel-specific function adapter or deployment configuration in this export. The production command starts a long-running Express server (`pnpm start`). Before a full Vercel deployment, the app needs a Vercel-compatible API/runtime setup and an external MySQL-compatible database. Authentication must also be explicitly configured for the Vercel domain or replaced with a supported provider. A static-only deployment will not provide sign-in, APIs, POS, or persistent inventory.

Use `.env.example` only as a list of configuration names; its values are intentionally blank. Do not assume that Manus-managed secrets or database credentials transfer to Vercel. Keep real credentials in Vercel environment settings, never in Git or chat.

## Local source commands

Use Node.js 22 and the repository's pinned pnpm 10.18.0:

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

`pnpm dev` starts the local development server. `pnpm start` runs the built Express application and requires valid authentication and database configuration. `pnpm db:migrate` applies the checked-in migrations to the configured database; review the target and backup plan before running it.

## Push the source to GitHub

1. Extract this archive.
2. Create an empty GitHub repository.
3. From the extracted folder, run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial Drip Cafe source import"
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Review the repository and keep it private while you confirm its intended contents and license.

## Demo data

The export intentionally contains no database rows. When you configure a separate Vercel database and authentication, recreate demo data only after the owner identity is established in that target environment. Do not import account IDs or credentials from the Manus database blindly.
