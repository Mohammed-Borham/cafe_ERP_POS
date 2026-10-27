# Drip Café Vercel Demo — Implementation Plan

## Product scope and separation

Prepare a separate Vercel source copy of Drip Café Operations for a client-facing MVP demonstration. Preserve the supplied Figma-inspired warm cream, charcoal, and burgundy visual system; responsive tablet/laptop layout; café POS, invoices, inventory, supplier receiving, warehouses, events, role administration and audit workflows. Do not modify or republish the existing Manus project or its shared database as part of this Vercel copy.

Keep role testing enabled. Replace Manus OAuth in the Vercel copy with first-party username/password login handled by the application backend. Provide pre-created demo identities for Owner, Admin, Barista and Event Staff, with role-specific permissions still enforced by protected backend procedures. No sign-up, password reset, real customer data or real payment processor is included. The login screen must identify these as shared demo accounts; anyone who can reach the demo can use them, so the deployment is for fictional data only.

## Implementation approach

### Backend login and authorization

Add nullable username, scrypt hash/salt and lockout fields to the existing application-user table through an additive migration. Store only a salted, slow password hash produced with Node's built-in scrypt; never store or log plaintext passwords. Add public login/logout endpoints and keep the existing `auth.me` identity query. On login, verify credentials server-side and issue a signed, HttpOnly cookie using a Vercel secret (`AUTH_SESSION_SECRET`). Use `Secure` in production, `SameSite=Lax` for the same-origin Vercel app, and a local-HTTP-compatible development setting. Resolve the current user and café role from persistent database records on every authenticated request; do not trust role claims from the browser or cookie. Do not expose a registration endpoint. Record sign-in activity once per successful login and preserve server-side permission checks for every existing café operation.

### Database and demo content

Use TiDB Cloud Serverless as the target hosted MySQL-compatible database, connected to Vercel through the TiDB Cloud Marketplace integration. Continue to use Drizzle and the existing MySQL schema/driver where compatible; store the connection only as Vercel's `DATABASE_URL` secret. Add an additive migration for backend credentials and any required indexes. Provide a one-time demo seed command that refuses to overwrite a non-empty business workspace. It should create the workspace, roles, four demo accounts, fictional products and suppliers, receiving, stock, events, example sales/invoices, payment records marked `DEMO ONLY`, stock movements and audit entries. The seed must not call a payment provider or touch the existing Manus database.

### Vercel serving

Add a root Express entrypoint that exports an app instead of calling `listen`, so Vercel can execute it as an Express Function. Keep the existing development server command for local work. Build the Vite client and place the generated static files under Vercel's `public/` directory. Serve client-side application routes with the built `index.html` while ensuring `/api/*` continues to reach Express/tRPC. Preserve health and route-manifest endpoints. Add Vercel build/configuration files and document that an environment change requires a new deployment.

### User interface

Add a Drip-branded login view with a username/password form and quick-fill role choices for Owner, Admin, Barista and Event Staff. Show the demo-only shared-access warning and credentials needed for this preview. Successful login refreshes `auth.me` and opens the existing workspace; logout clears the backend session cookie. Keep tablet-friendly touch targets and existing dashboard/POS design.

## Design system

Reuse the existing Figma reference rather than introducing a new visual style. Use the specialty-café operational aesthetic: warm cream/stone surfaces, dark charcoal navigation and restrained burgundy/terracotta brand accents. Keep information dense but readable, with clear status colors, explicit stock/payment impact and concise operational copy. Preserve the compact “drip café” wordmark and the existing responsive sidebar/POS layout.

## Project structure

- `client/src/pages/` — existing café workspace plus the new demo login screen.
- `client/src/_core/hooks/useAuth.ts` — first-party login, identity refresh and logout behavior.
- `server/routers.ts` and `server/cafe.ts` — public login plus existing permission-checked café operations.
- `server/_core/` — app session signing, request authentication, Express app factory and the local development listener.
- `index.ts` — Vercel Express Function entrypoint.
- `drizzle/schema.ts` and `drizzle/` — credentials schema and additive migration.
- `scripts/seed-demo.ts` — non-destructive setup of fictional role accounts and demo workspace data.
- `scripts/build-vercel.sh` and `vercel.json` — static asset preparation and Vercel build settings.
- `docker-compose.yml` — local app and isolated MySQL database, startup migrations, localhost-only ports and persistent local volumes; run the demo seed explicitly.
- `.env.example` — variable names and blank values only; no secrets.

## Material constraints

1. The existing Manus deployment and its database remain untouched. The Vercel project uses a separate TiDB database.
2. Demo credentials are intentionally usable by anyone who has the public demo URL. Never use those accounts for real business records.
3. Paymob/Cashier is still unconfigured. Payment entries in seeded data are visibly marked as fictional; no live transactions are sent or received.
4. Vercel/TiDB account creation and secret entry require the user to complete provider dashboards. Never commit secrets or a live database export.
5. Existing stock, event reconciliation, corrections, attribution, audit and granular permissions must continue to work against the new backend session identities.
