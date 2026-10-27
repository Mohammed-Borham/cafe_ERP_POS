# Drip Café Operations — Vercel demo source

This is a separate source copy prepared for a client-facing Vercel demo. It does not change the existing Manus website or its database. It includes a Vercel Express-function entrypoint, backend username/password sessions, the existing café permission checks, a guarded demo-data seeder, and the Figma-inspired tablet/laptop interface.

**This source is not already deployed.** You must create the Vercel project and a separate MySQL-compatible database, add its environment variables, apply the migrations, and run the demo seeder. Do not connect this copy to the Manus-managed database.

## Demo login

The login page offers quick-fill buttons. All four accounts use the same demo password:

```text
Password: DripDemo!2026

owner   — Owner access
admin   — Admin access
barista — Barista access
event   — Event Staff access
```

These are shared fictional accounts. Anyone who can reach the public demo can use them and change the fictional records. Do not use real staff credentials, customer information, business records, or payment details. There is no sign-up or password-reset page. Passwords are stored as salted scrypt hashes in the database. The login cookie is signed by the backend and permissions are loaded from the database for each request. Role quick-fill buttons only fill the form; the backend still authenticates each login.

Paymob/Cashier is not connected. The seeded payment records are marked `DEMO` and do not call a payment provider. Offline mode is not included.

## 1. Push this folder to GitHub

Extract the ZIP and open a terminal in the extracted folder. Create an empty GitHub repository, then run these commands, replacing the URL with your repository URL:

```bash
git init
git branch -M main
git add .
git commit -m "Prepare Drip Cafe Vercel demo"
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Keep `.env`, `.env.local`, `node_modules`, `dist`, `public` build output, and `.vercel` out of Git. `.gitignore` already excludes these. Never put database URLs or session secrets in GitHub.

## 2. Import the GitHub repository into Vercel

In Vercel, choose **Add New → Project**, import the repository, and deploy. The root `index.ts` exports the Express application as a Vercel Function. `vercel.json` selects `pnpm build:vercel`; that command builds Vite and copies the client assets into Vercel's generated `public/` folder. The explicit rewrites send the café page paths to that SPA document and leave `/api/*` with Express. Keep the project root at the repository root and use Node.js 22 with pnpm 10.18.0.

## 3. Connect a separate TiDB database and add the session secret

Create a TiDB Cloud Serverless database and connect it to this Vercel project with the TiDB Marketplace integration. In Vercel **Project → Settings → Environment Variables**, verify that `DATABASE_URL` is available to the deployment environments you intend to use. It must point to the new TiDB database, not Manus. Vercel's integration setup is described in the [TiDB Cloud/Vercel guide](https://docs.pingcap.com/tidbcloud/integrate-tidbcloud-with-vercel/).

Generate a random session-signing value on your computer:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Add the result to Vercel as `AUTH_SESSION_SECRET` for Production. Add it for Preview too if you will test preview deployments. Do not paste it into GitHub or chat. Vercel requires a new deployment after environment-variable changes for the change to take effect.

The required environment variables are `DATABASE_URL` and `AUTH_SESSION_SECRET`. `NODE_ENV` and `PORT` in `.env.example` are for local development; Vercel sets its runtime environment itself.

## 4. Apply the database migrations and insert demo data

Install Node.js 22, pnpm 10.18.0 and the Vercel CLI on your computer. From the extracted repository, authenticate and link the folder to the Vercel project:

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
npm install --global vercel
vercel login
vercel link
```

Make sure Vercel's **Production** environment is linked to the new, empty TiDB database and has both required variables. Then run the commands below from the repository folder. They use the linked Production environment directly; secret values are not written into this repository:

```bash
vercel env run -e production -- pnpm db:migrate
vercel env run -e production -- pnpm db:seed-demo
```

The migration creates the application tables and backend-login fields. The one-time seeder creates a fictional café, two warehouses, products, receiving, café/event stock, sample invoices, demo payment records, and audit entries. It also creates the four role accounts above. It checks for existing application rows in a transaction and aborts rather than deleting, resetting, or overwriting data. If the seeder refuses to run, verify that the selected `DATABASE_URL` is the intended new empty database; do not manually clear a database that contains anything you need.

## 5. Deploy and test the roles

After the migration and seed complete, open the Vercel deployment URL. Choose a role button on the sign-in screen, confirm the username and shared password are filled in, and click **Sign in**. Test the Owner, Admin, Barista and Event Staff accounts on separate devices or browser sessions to compare their backend-enforced access. Vercel will create the production deployment from the configured Git branch; if you changed environment variables after the deployment started, redeploy the latest commit.

## Local checks

```bash
pnpm check
pnpm test
pnpm build:vercel
```

For local API work, create a private `.env` from `.env.example`, fill it with a separate test `DATABASE_URL` and a random `AUTH_SESSION_SECRET`, run `pnpm db:migrate` and `pnpm db:seed-demo`, then use `pnpm dev`. Do not point local testing at the Manus database or share the `.env` file.

## What is not live yet

No Vercel account, project, TiDB cluster, environment variables, migration, seed run, or deployment was created from this source package. No Paymob/Cashier integration is active. The public demo credentials are intentionally weak/shared for role testing, so this is not suitable for real operations.

For Vercel deployment and environment-variable details, see [VERCEL_REFERENCES.md](VERCEL_REFERENCES.md). The package also contains `plan.md` and `TODO.md` describing implementation decisions and the setup steps that still require your Vercel/TiDB accounts.