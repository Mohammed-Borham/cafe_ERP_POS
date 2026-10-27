# Drip Café Operations — MVP Plan

## Product scope

Build a responsive, internet-connected café operations web app based on the supplied Figma screen exports. Follow the reference's dark charcoal/brown navigation, warm cream work surfaces, restrained burgundy/terracotta accents, operational cards and tables, product-card POS, and inventory/invoice workspaces. Laptop and tablet layouts are required; baristas use tablets. Offline operation is deferred to a later phase.

Connect individual staff identity and granular access control with supplier receiving, separately tracked warehouses, a café stock location, POS sales/invoices, payment transaction records, event stock transfers/sales/returns, and an audit history. The owner has unrestricted access. The seeded Admin role starts with system-wide operational, user and role-management permissions; the owner can tailor or reduce them. Every other role receives only its assigned actions. Part-time workers do not need accounts unless later requested.

## Implementation approach

Use the initialized React + TypeScript + Tailwind client with Express/tRPC APIs and the selected managed MySQL-compatible database, using the existing Drizzle ORM and starter OAuth/session foundation. Retain Manus OAuth; do not introduce a separate email/password login. Link each authenticated identity to an application account and role. A user without an enabled application account is denied operational access. The first authenticated user can explicitly complete the one-time owner setup only while no workspace/owner exists; after setup no other visitor can claim owner status. Confirm this bootstrap identity with the business during onboarding. Enforce permissions on every protected server procedure as well as reflecting them in the UI.

Persist core entities and transaction history through additive Drizzle schema/migrations. Keep stock movements and audit entries traceable by actor, time, location and linked invoice/event where applicable. Receiving, POS sales, transfers, event close/return, invoice correction and adjustments must update linked stock and financial records together. Store the selected event-return warehouse so post-close invoice corrections adjust returned warehouse stock instead of recreating stock at a closed event. Corrections retain before/after values and a reason; changed invoice totals become pending for reconciliation instead of being silently treated as paid. Avoid destructive SQL or synthetic operational transactions in the shared development/production database.

Provide provider-independent payment transaction records (provider, unique provider reference, amount, status and linked sale/invoice) and permission-controlled manual reconciliation. The Paymob/Cashier integration is visibly unconfigured. Provider selection, API credentials, API/webhook documentation and environment details are expected after the kickoff meeting; until supplied, do not call a live provider or claim automatic transaction ingestion. Keep any future secrets server-side.

## Main workflows and screens

- **Dashboard:** café operations overview and recent sales, stock attention and activity.
- **POS:** tablet-usable product cards and cart, sold only from available stock at the selected café/event location, with staff attribution, invoice/payment status and inventory reduction.
- **Sales & invoices:** searchable records, permission-controlled invoice corrections requiring a reason, visible correction snapshots and payment reconciliation/reference traceability.
- **Inventory & suppliers:** create/manage multiple warehouses, supplier receiving into a selected warehouse, café/warehouse/event location transfers, stock movement history, low-stock visibility and permissioned adjustments.
- **Events:** create off-site event/location, send selected stock from a warehouse, attribute event sales to the signed-in staff member, reconcile sent/sold/returned/adjusted/on-hand stock by product, return remaining stock to a selected warehouse, and expose nonzero variances.
- **Users, roles & permissions:** assign individual app accounts, enable/disable access, create roles and edit an action-level permission catalog. Owner is unrestricted; owner and granted admins can administer roles/users. Admins cannot assign the reserved Owner role.
- **Audit log:** permissioned history for sign-ins/attributed actions, sales, invoice revisions, payments, receiving, suppliers, stock movements, event lifecycle, accounts and roles, with before/after values and reason where relevant.
- **Settings:** show business/branch, currency, café stock location and explicit provider integration status.

## Data and service boundaries

Initial data model includes app accounts and roles/permission assignments; workspace and branch setup; products and suppliers; warehouses and stock locations; receiving records/lines; sales/invoices/lines; payment transactions; stock and movement ledger; events; corrections; and audit entries. Start with one branch and support multiple warehouses. After login, provide a one-time owner setup for business name, branch, currency, starting warehouse and café stock location. Tax, invoice numbering, discounts and refunds/voids remain business decisions; do not fabricate real operational data.

The system uses Manus OAuth identities linked to app-specific roles. Event stock reconciliation is derived from movements and current stock, not a user-entered total. Paymob/Cashier transaction ingestion remains out of scope until the promised kickoff information arrives. Development and published runtime share the managed database.

## Design system

- **Design movement:** specialty-café point-of-sale utility, following the user's Figma export.
- **Core principles:** calm and legible; operationally dense without crowding; connected records with visible stock impact; explicit permission-sensitive actions.
- **Color philosophy:** warm cream and stone for reduced glare; deep charcoal for navigation; muted burgundy/terracotta for the Drip brand; green/amber/red reserved for status and attention.
- **Layout paradigm:** persistent compact desktop sidebar, collapsible tablet navigation, task-specific work surfaces and a nearby/fixed POS cart on wide screens; readable mobile/tablet tables.
- **Signature elements:** terracotta primary controls; warm-tinted transaction panels; consistent stock/payment pills.
- **Interaction philosophy:** immediate feedback for ordinary edits, confirmation for inventory/financial impact, reason entry for corrections/adjustments, and contextual permission-denied states.
- **Animation:** subtle 120–180 ms transitions for navigation/drawers/status; no checkout motion; honor reduced-motion preferences.
- **Typography system:** clean system sans for operational data; restrained editorial heading accent; clear numeric hierarchy.
- **Brand essence:** a connected back-office and counter workspace for Drip Café that keeps sales, people and stock in sync; **grounded, clear, dependable**.
- **Brand voice:** direct, calm and operational. Examples: “Stock moved to Riverside pop-up.” “Enter a reason to continue with this invoice correction.”
- **Wordmark & logo:** preserve the compact “drip café” treatment from Figma with a simple drop/coffee mark.
- **Signature brand color:** muted Drip burgundy/terracotta.

## Project structure

- `client/src/pages/Home.tsx` — current route-aware dashboard, POS, sales/invoices, inventory, receiving/suppliers, events, team/roles, audit and settings workspace.
- `client/src/components/` — reusable supplied UI primitives and error boundary.
- `client/src/lib/trpc.ts` and `client/src/_core/` — typed API client and OAuth/session hooks.
- `server/routers.ts` and `server/cafe.ts` — root API composition and permission-checked café domain procedures.
- `server/db.ts` and `drizzle/schema.ts` — managed database connection and Drizzle schema.
- `drizzle/` — additive SQL migrations and journal.
- `client/public/manus-routes.json` — page-route manifest kept synchronized with `client/src/App.tsx`.

## Material constraints and decisions

1. Paymob/Cashier provider selection, credentials, API/webhook specifications and environment details arrive after the kickoff meeting. Until then the integration stays visibly pending; do not put secret keys in source.
2. Manus OAuth is the MVP login provider. Staff who need access use individual eligible identities.
3. The first authenticated user completes explicit one-time owner setup, then business data such as initial products/suppliers, currency and tax/invoice rules is configured as provided.
4. Invoice corrections preserve the original and revised record, actor, timestamp and reason. Payment reversals/refunds need business rules before being expanded beyond the current permission-controlled payment record.
5. The managed database is shared across development and production; avoid destructive migrations and synthetic operational writes.

## Frontend/backend serving

Serve the React app, tRPC API and health endpoint from the initialized Express app on configured port 3000. Use relative browser API paths and preserve OAuth sessions with embedded-Preview-compatible cookie attributes. Serve `/manus-routes.json` as static JSON synchronized to page routes. Persist business state in the managed database; supply future provider credentials only through protected server-side configuration.
