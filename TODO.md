# MVP Outcomes

## 1. Responsive app shell and sign-in
- [x] Build a responsive web system that works over the internet from laptops and tablets; baristas use tablets. Offline work is explicitly deferred to a later phase.
- [x] Use Manus OAuth for the MVP. Users who need access sign in with individual identities; the application links each authenticated identity to a Drip Café user and role. A user without an enabled app account cannot use operations.
- [x] Provide an initial post-login owner/business setup path. While no owner exists, the authenticated user must explicitly complete owner setup; once an owner exists, no other visitor can claim owner status. Use setup to enter business name, branch, currency, starting warehouse and café stock location; add initial products and suppliers through their authorized modules.
- [x] Follow the Figma exports: dark charcoal/brown navigation, warm cream work surfaces, restrained burgundy/terracotta accents, operational cards/tables, product-card POS and inventory/invoice workspaces.

## 2. Owner, admins, roles and granular permissions
- [x] Owner has unrestricted access to all system operations, user management, role/permission management and settings.
- [x] Admins have only permissions assigned by the owner. The seeded Admin role starts with all available system-operation and user/role permissions, and the owner can tailor that action-level assignment.
- [x] Authorized users can create roles and control permissions by action across system areas; the permissions interface clearly shows the available actions.
- [x] Enforce authorization on server-side operations as well as in the user interface. Part-time workers do not need accounts unless later requested.

## 3. Individual staff identity and audit history
- [x] Attribute operational actions to the signed-in individual so the system identifies who is using it; show current staff presence and last sign-in.
- [x] Keep system-wide, permissioned audit history, recording who did what and when. Preserve before/after values and reason for invoice corrections and relevant stock adjustments.
- [x] Audit sign-ins, sales, invoice revisions, payment records/reconciliation, receiving, supplier activity, stock movements, event movements/returns/adjustments, user accounts and role/permission changes.

## 4. Suppliers, receiving, invoices and inventory
- [x] Support suppliers, sales invoices, receiving, inventory, warehouse management and current branch operations as one connected workflow; initial setup records the business's current branch.
- [x] Record receiving by items/quantities/costs, supplier, date and destination warehouse; confirmed receiving increases that warehouse's stock and retains the supplier invoice/reference identifier where applicable.
- [x] Track stock separately for each warehouse and maintain traceable stock movement records for receiving, sales, transfers, returns and adjustments.
- [x] Allow authorized users to create additional warehouse locations so multiple warehouses can be managed separately.
- [x] Support permission-controlled stock adjustments and warehouse/café/event stock transfers with source, destination, item quantities, actor and timestamps.

## 5. Café POS sales and payment transaction records
- [x] Provide a tablet-usable POS with product selection, cart, sale completion, signed-in staff attribution and sale/invoice records.
- [x] Connect completed café sales to ERP records and reduce stock from the configured café stock location.
- [x] Persist payment transaction records with provider reference/status/amount and a link to sale/invoice; make reconciliation or correction permission-controlled and audited.
- [x] Until provider details arrive, label the external integration as pending/unconfigured and do not claim live automatic ingestion.
- [ ] After the kickoff meeting, integrate the selected Paymob or Cashier provider by API so external transactions connect automatically. The final provider, credentials, API/webhook specifications and environment details are pending from the customer; activate live transaction ingestion only after these are supplied.

## 6. Invoice corrections and financial traceability
- [x] A user may revise an invoice made by mistake only if granted the relevant permission.
- [x] Preserve the original invoice values, revised values, actor, timestamp and correction reason in audit history; do not silently erase or overwrite finalized history.
- [x] Keep linked stock/payment records consistent with authorized corrections. Changed totals become pending for reconciliation; post-close event invoice corrections adjust the recorded return warehouse stock. Refund, void and cancellation rules remain outside this MVP until the business confirms them.

## 7. Off-site events and event stock lifecycle
- [x] Authorized users can create event records with off-site location and event details.
- [x] Before event sales, transfer selected quantities from a source warehouse to the event stock location, recording source, destination, quantities, actor and time.
- [x] Event staff sign in with individual accounts and event sales are attributed to the signed-in person and event; each sale reduces event stock and links to the payment transaction record.
- [x] After an event, record remaining stock returned to a selected warehouse. Show differences between stock sent, sold, returned and adjusted; adjustments require permission and audit history.

## 8. Preview/app routes and durable application records
- [x] Implement domain persistence in the selected managed database using additive, deterministic migrations; development and published app share that database, so avoid destructive tests or synthetic operational writes.
- [x] Keep a static `/manus-routes.json` manifest synchronized with all client page routes.
- [x] Keep external provider secrets server-side and out of source code; activate live payment callbacks only after provider setup information is received.
