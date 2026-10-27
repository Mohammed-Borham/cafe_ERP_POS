# Vercel Demo Outcomes

## 1. Vercel-compatible app serving
- [x] Export a root Express application entrypoint for Vercel Functions; it must not start a long-running listener inside a function invocation.
- [x] Build the React/Vite client into generated Vercel-served static assets and return the SPA entry document for client page routes without swallowing `/api/*` routes.
- [x] Preserve the health and route-manifest HTTP endpoints and document the Vercel build command and project settings.

## 2. Backend-managed login for role testing
- [x] Replace Manus OAuth in this Vercel copy with backend username/password login; do not add public sign-up or a client-side role switch that bypasses authentication.
- [x] Provide pre-created test identities for Owner, Admin, Barista and Event Staff so the client can sign in separately and compare their permissions.
- [x] Store only salted password hashes in persistent storage; verify passwords in the backend and issue an HttpOnly signed session cookie. Use Secure cookies in production and same-origin cookie policy on Vercel.
- [x] Resolve the signed-in user and current café role from the database on protected requests; retain backend action-level permission enforcement.
- [x] Provide sign-out and record sign-in once in audit history per successful login. Show clear “shared demo accounts; fictional data only” messaging on the login page.

## 3. TiDB persistence and demo data
- [x] Support a separate TiDB Cloud MySQL-compatible database connected to Vercel through its integration; this Vercel copy uses `DATABASE_URL` and must not point to the Manus-managed database.
- [x] Add an additive migration for backend login credentials and required indexes; preserve existing migration history.
- [x] Provide an explicit, transactional demo seed command that refuses to overwrite an existing non-empty workspace. It creates one clearly labeled demo business, four role accounts, fictional sample products and suppliers, receiving, stock, two warehouses, café stock, events, event transfers/sales, invoices, payment records and audit entries.
- [x] Give demo rows `DEMO` identifiers or notes; no real Paymob/Cashier transactions, customer data or sensitive business data are seeded.
- [x] Provide initial demo credentials and explain that anyone who can access the public demo URL can use them and modify fictional demo records.
- [ ] After you create/connect the Vercel project and separate empty TiDB database, apply the migration and run the seed command against the intended Production environment. This has not been run because no external database credentials were provided.

## 4. Preserve Drip Café workflows and permissions
- [x] Keep the Figma-inspired warm café look and responsive laptop/tablet workspace.
- [x] Keep action-level permissions enforced in backend operations; Owner has unrestricted access, the seeded Admin role starts with operational and role-management actions, and Barista/Event Staff remain role-limited.
- [x] Keep supplier receiving, separate warehouse/café/event stock, transfers, sales, invoices, event returns, reconciliation and audit history as connected workflows.
- [x] Preserve permission-controlled invoice corrections with original/revised values, actor, timestamp and reason.
- [x] Keep manual payment records linked to invoices, visibly unconfigured external provider integration, and no live payment calls until Paymob/Cashier setup details are supplied.

## 5. Local Docker Compose setup
- [x] Add `docker-compose.yml` using Node 22 and MySQL 8.4, with separate named local database/dependency volumes; wait for MySQL health, apply pending migrations on startup, then run the development server.
- [x] Bind app and database ports to host loopback by default. Use explicitly local-only database passwords and session-signing value; do not point at Manus or Vercel data.
- [x] Keep demo seeding explicit and document `docker compose exec app pnpm db:seed-demo`; use the guarded seeder instead of automatically resetting local data.
- [x] Allow optional trusted-LAN testing only through an explicit app-port mapping and a `DRIP_ALLOWED_HOSTS` host allowlist; document that the demo must not be port-forwarded publicly.
- [x] Remove the Manus network/session-replay collector from the standalone development build so login traffic is not sent to a local debug log endpoint.

## 6. Project handoff
- [x] Update the README with GitHub import steps, Vercel/TiDB setup, environment-variable names, migrations, demo seeding, Docker Compose local setup and the public-demo security limitation.
- [x] Create and validate the source ZIP at `/home/ubuntu/Downloads/dripcafe-vercel-demo-20261028.zip`, excluding `.env` files (except the blank `.env.example`), credentials, Git history, build artifacts, and database dumps.
