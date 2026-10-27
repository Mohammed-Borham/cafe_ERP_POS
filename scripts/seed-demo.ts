import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { count } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  cafeAccounts,
  cafeAudit,
  cafeCorrections,
  cafeEvents,
  cafeLocations,
  cafePayments,
  cafeProducts,
  cafeReceivings,
  cafeReceivingLines,
  cafeRoles,
  cafeSaleLines,
  cafeSales,
  cafeStock,
  cafeStockMovements,
  cafeSuppliers,
  cafeWarehouses,
  cafeWorkspaces,
  users,
} from "../drizzle/schema";

const scrypt = promisify(scryptCallback);
const demoPassword = "DripDemo!2026";
const permissions = {
  Owner: ["dashboard.view", "pos.access", "sales.view", "sales.create", "sales.correct", "payments.view", "payments.reconcile", "inventory.view", "inventory.receive", "inventory.transfer", "inventory.adjust", "warehouses.manage", "products.manage", "suppliers.manage", "events.view", "events.manage", "events.sell", "users.view", "users.manage", "roles.manage", "audit.view", "settings.manage"],
  Admin: ["dashboard.view", "pos.access", "sales.view", "sales.create", "sales.correct", "payments.view", "payments.reconcile", "inventory.view", "inventory.receive", "inventory.transfer", "inventory.adjust", "warehouses.manage", "products.manage", "suppliers.manage", "events.view", "events.manage", "events.sell", "users.view", "users.manage", "roles.manage", "audit.view", "settings.manage"],
  Barista: ["dashboard.view", "pos.access", "sales.view", "sales.create", "payments.view", "inventory.view"],
  "Event Staff": ["dashboard.view", "pos.access", "sales.view", "sales.create", "payments.view", "inventory.view", "events.view", "events.sell"],
};

const tablesToCheck = [
  cafeWorkspaces, cafeRoles, cafeAccounts, cafeLocations, cafeWarehouses,
  cafeProducts, cafeSuppliers, cafeEvents, cafeStock, cafeReceivings,
  cafeReceivingLines, cafeSales, cafeSaleLines, cafePayments,
  cafeStockMovements, cafeCorrections, cafeAudit, users,
];

function insertedId(result: unknown): number {
  const id = Number((result as [{ insertId: number }])[0]?.insertId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Database did not return a valid inserted ID");
  return id;
}

async function passwordFields() {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(demoPassword, salt, 64)) as Buffer;
  return { passwordSalt: salt, passwordHash: hash.toString("hex") };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required");
  if (!process.env.AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET.length < 32) {
    throw new Error("Set AUTH_SESSION_SECRET to a random value of at least 32 characters before seeding");
  }
  const db = await getDb();
  if (!db) throw new Error("Could not connect to database");

  await db.transaction(async (tx) => {
    // The guard and writes share one transaction: any existing app/auth/demo data aborts before inserts.
    for (const table of tablesToCheck) {
      const [{ value }] = await tx.select({ value: count() }).from(table);
      if (Number(value) !== 0) {
        const tableName = table[Symbol.for("drizzle:Name")] ?? "application table";
        throw new Error(`Refusing to seed: ${String(tableName)} contains rows. This seeder never overwrites business data.`);
      }
    }

    const roleIds = new Map<string, number>();
    for (const [name, perms] of Object.entries(permissions)) {
      roleIds.set(name, insertedId(await tx.insert(cafeRoles).values({
        name, isSystem: true, isOwner: name === "Owner", permissions: perms,
      })));
    }

    const demoUsers = [
      { username: "owner", name: "Demo Owner", email: "owner@example.invalid", role: "admin" as const },
      { username: "admin", name: "Demo Admin", email: "admin@example.invalid", role: "user" as const },
      { username: "barista", name: "Demo Barista", email: "barista@example.invalid", role: "user" as const },
      { username: "event", name: "Demo Event Staff", email: "event@example.invalid", role: "user" as const },
    ];
    const userIds: Record<string, number> = {};
    for (const demoUser of demoUsers) {
      userIds[demoUser.username] = insertedId(await tx.insert(users).values({
        openId: `demo_${demoUser.username}`,
        ...demoUser,
        loginMethod: "demo-password",
        ...await passwordFields(),
      }));
    }

    const workspaceId = insertedId(await tx.insert(cafeWorkspaces).values({
      workspaceKey: "drip", businessName: "Drip Demo Café", branchName: "Fictional Sample Branch",
      currency: "USD", ownerUserId: userIds.owner,
    }));
    for (const [username, roleName] of [["owner", "Owner"], ["admin", "Admin"], ["barista", "Barista"], ["event", "Event Staff"]]) {
      await tx.insert(cafeAccounts).values({ userId: userIds[username], roleId: roleIds.get(roleName)!, active: true });
    }

    const warehouseLocationId = insertedId(await tx.insert(cafeLocations).values({ name: "Demo Warehouse", type: "warehouse" }));
    const cafeLocationId = insertedId(await tx.insert(cafeLocations).values({ name: "Demo Café Counter", type: "cafe" }));
    const reserveLocationId = insertedId(await tx.insert(cafeLocations).values({ name: "Demo Reserve Warehouse", type: "warehouse" }));
    const warehouseId = insertedId(await tx.insert(cafeWarehouses).values({
      name: "Demo Central Store", location: "Fictional Demo District", locationId: warehouseLocationId,
    }));
    await tx.insert(cafeWarehouses).values({
      name: "Demo Reserve Store", location: "Fictional Demo District", locationId: reserveLocationId,
    });
    const supplierId = insertedId(await tx.insert(cafeSuppliers).values({
      name: "Imaginary Bean Cooperative", contactName: "Sample Contact",
      email: "supplier@example.invalid", phone: "000-000-0000",
    }));

    const products = [
      { name: "Demo House Espresso", sku: "DEMO-ESP-001", category: "Coffee", price: "3.50", unit: "cup", lowStockThreshold: "5.000" },
      { name: "Fictional Oat Latte", sku: "DEMO-LAT-002", category: "Coffee", price: "5.25", unit: "cup", lowStockThreshold: "5.000" },
      { name: "Sample Cocoa Cookie", sku: "DEMO-CKI-003", category: "Bakery", price: "2.75", unit: "piece", lowStockThreshold: "4.000" },
    ];
    const productIds: number[] = [];
    for (const product of products) productIds.push(insertedId(await tx.insert(cafeProducts).values(product)));

    const receivedQty = ["80.000", "80.000", "80.000"];
    const costs = ["8.00", "12.00", "4.75"];
    // 80 units of each item: 80×$8 + 80×$12 + 80×$4.75 = $1,980.
    const receivingId = insertedId(await tx.insert(cafeReceivings).values({
      reference: "DEMO-RECV-001", supplierId, warehouseId, total: "1980.00",
      note: "Fictional demo receiving; quantities and costs reconcile to receiving lines.", actorId: userIds.owner,
    }));
    for (let i = 0; i < productIds.length; i++) {
      await tx.insert(cafeReceivingLines).values({ receivingId, productId: productIds[i], quantity: receivedQty[i], unitCost: costs[i] });
    }

    const eventLocationId = insertedId(await tx.insert(cafeLocations).values({ name: "Demo Community Market", type: "event" }));
    const eventId = insertedId(await tx.insert(cafeEvents).values({
      name: "Fictional Autumn Market", location: "Demo Community Plaza",
      startDate: new Date(Date.now() + 86_400_000), endDate: new Date(Date.now() + 90_000_000),
      status: "open", locationId: eventLocationId, returnWarehouseLocationId: warehouseLocationId, actorId: userIds.owner,
    }));

    // Opening stock is represented by receiving movements, then transfer and sale movements.
    const cafeTransfers = ["25.000", "25.000", "25.000"];
    const eventTransfers = ["10.000", "10.000", "10.000"];
    const reserveTransfers = ["5.000", "5.000", "5.000"];
    const cafeSold = ["1.000", "0.000", "1.000"];
    const eventSold = ["0.000", "1.000", "0.000"];
    for (let i = 0; i < productIds.length; i++) {
      await tx.insert(cafeStockMovements).values({ productId: productIds[i], quantity: receivedQty[i], toLocationId: warehouseLocationId, reason: "Fictional demo receiving", actorId: userIds.owner, referenceType: "receiving", referenceId: receivingId });
      await tx.insert(cafeStockMovements).values({ productId: productIds[i], quantity: cafeTransfers[i], fromLocationId: warehouseLocationId, toLocationId: cafeLocationId, reason: "Fictional transfer to café counter", actorId: userIds.owner, referenceType: "demo", referenceId: workspaceId });
      await tx.insert(cafeStockMovements).values({ productId: productIds[i], quantity: eventTransfers[i], fromLocationId: warehouseLocationId, toLocationId: eventLocationId, reason: "Fictional transfer to event", actorId: userIds.owner, referenceType: "event", referenceId: eventId });
      await tx.insert(cafeStockMovements).values({ productId: productIds[i], quantity: reserveTransfers[i], fromLocationId: warehouseLocationId, toLocationId: reserveLocationId, reason: "Fictional transfer to reserve warehouse", actorId: userIds.owner, referenceType: "transfer", referenceId: workspaceId });
      const warehouseBalance = 80 - 25 - 10 - 5;
      const cafeBalance = 25 - Number(cafeSold[i]);
      const eventBalance = 10 - Number(eventSold[i]);
      await tx.insert(cafeStock).values({ locationId: warehouseLocationId, productId: productIds[i], quantity: `${warehouseBalance}.000` });
      await tx.insert(cafeStock).values({ locationId: reserveLocationId, productId: productIds[i], quantity: reserveTransfers[i] });
      await tx.insert(cafeStock).values({ locationId: cafeLocationId, productId: productIds[i], quantity: `${cafeBalance}.000` });
      await tx.insert(cafeStock).values({ locationId: eventLocationId, productId: productIds[i], quantity: `${eventBalance}.000` });
    }

    // Café sale: espresso $3.50 + cookie $2.75 = $6.25.
    const cafeSaleId = insertedId(await tx.insert(cafeSales).values({
      invoiceNo: "DEMO-INV-001", source: "cafe", actorId: userIds.barista,
      total: "6.25", paymentMethod: "cash", paymentStatus: "paid",
    }));
    await tx.insert(cafeSaleLines).values([
      { saleId: cafeSaleId, productId: productIds[0], name: products[0].name, quantity: "1.000", unitPrice: "3.50" },
      { saleId: cafeSaleId, productId: productIds[2], name: products[2].name, quantity: "1.000", unitPrice: "2.75" },
    ]);
    await tx.insert(cafePayments).values({ saleId: cafeSaleId, provider: "manual-demo-cash", providerReference: "DEMO-PAY-001", amount: "6.25", status: "paid" });
    // Event sale: one latte at $5.25.
    const eventSaleId = insertedId(await tx.insert(cafeSales).values({
      invoiceNo: "DEMO-INV-002", source: "event", eventId, actorId: userIds.event,
      total: "5.25", paymentMethod: "terminal", paymentStatus: "paid",
    }));
    await tx.insert(cafeSaleLines).values({ saleId: eventSaleId, productId: productIds[1], name: products[1].name, quantity: "1.000", unitPrice: "5.25" });
    await tx.insert(cafePayments).values({ saleId: eventSaleId, provider: "manual-demo-terminal", providerReference: "DEMO-PAY-002", amount: "5.25", status: "paid" });

    for (let i = 0; i < productIds.length; i++) {
      if (Number(cafeSold[i]) > 0) await tx.insert(cafeStockMovements).values({ productId: productIds[i], quantity: cafeSold[i], fromLocationId: cafeLocationId, reason: "Fictional café sale deduction", actorId: userIds.barista, referenceType: "sale", referenceId: cafeSaleId });
      if (Number(eventSold[i]) > 0) await tx.insert(cafeStockMovements).values({ productId: productIds[i], quantity: eventSold[i], fromLocationId: eventLocationId, reason: "Fictional event sale deduction", actorId: userIds.event, referenceType: "sale", referenceId: eventSaleId });
    }
    for (const [username, actorId] of Object.entries(userIds)) {
      await tx.insert(cafeAudit).values({ actorId, action: "seed_demo", entity: "user", entityId: actorId, summary: `Created fictional demo ${username} account`, afterData: { demo: true, nonProduction: true } });
    }
  });

  console.log("Demo database initialized. DEMO ONLY: owner/admin/barista/event all use DripDemo!2026. Never use these credentials in production.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
