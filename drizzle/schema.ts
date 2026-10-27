import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 128 }),
  passwordSalt: varchar("passwordSalt", { length: 64 }),
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const cafeWorkspaces = mysqlTable("cafe_workspaces", {
  id: int("id").autoincrement().primaryKey(),
  workspaceKey: varchar("workspaceKey", { length: 32 }).notNull().default("drip"),
  businessName: varchar("businessName", { length: 200 }).notNull(),
  branchName: varchar("branchName", { length: 200 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  ownerUserId: int("ownerUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, t => [uniqueIndex("cafe_workspace_key_uq").on(t.workspaceKey)]);
export const cafeRoles = mysqlTable("cafe_roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  isSystem: boolean("isSystem").default(false).notNull(),
  isOwner: boolean("isOwner").default(false).notNull(),
  permissions: json("permissions").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const cafeAccounts = mysqlTable("cafe_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  roleId: int("roleId"),
  active: boolean("active").default(false).notNull(),
  lastAuditedLoginAt: timestamp("lastAuditedLoginAt"),
  lastSeenAt: timestamp("lastSeenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const cafeLocations = mysqlTable("cafe_locations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: mysqlEnum("type", ["warehouse", "cafe", "event"]).notNull(),
  warehouseId: int("warehouseId"),
  eventId: int("eventId"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const cafeWarehouses = mysqlTable("cafe_warehouses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  location: varchar("location", { length: 500 }).notNull(),
  active: boolean("active").default(true).notNull(),
  locationId: int("locationId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const cafeProducts = mysqlTable("cafe_products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  category: varchar("category", { length: 100 }).notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 40 }).notNull(),
  lowStockThreshold: decimal("lowStockThreshold", {
    precision: 12,
    scale: 3,
  }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const cafeSuppliers = mysqlTable("cafe_suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  contactName: varchar("contactName", { length: 200 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 60 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const cafeEvents = mysqlTable("cafe_events", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  location: varchar("location", { length: 500 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  locationId: int("locationId").notNull(),
  returnWarehouseLocationId: int("returnWarehouseLocationId"),
  actorId: int("actorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const cafeStock = mysqlTable(
  "cafe_stock",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("locationId").notNull(),
    productId: int("productId").notNull(),
    quantity: decimal("quantity", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    uniqueIndex("cafe_stock_location_product_uq").on(t.locationId, t.productId),
  ]
);
export const cafeReceivings = mysqlTable("cafe_receivings", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 120 }).notNull(),
  supplierId: int("supplierId"),
  warehouseId: int("warehouseId").notNull(),
  total: decimal("total", { precision: 14, scale: 2 }).notNull(),
  note: text("note"),
  actorId: int("actorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const cafeReceivingLines = mysqlTable("cafe_receiving_lines", {
  id: int("id").autoincrement().primaryKey(),
  receivingId: int("receivingId").notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(),
  unitCost: decimal("unitCost", { precision: 14, scale: 2 }).notNull(),
});
export const cafeSales = mysqlTable("cafe_sales", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNo: varchar("invoiceNo", { length: 80 }).notNull().unique(),
  source: mysqlEnum("source", ["cafe", "event"]).notNull(),
  eventId: int("eventId"),
  actorId: int("actorId").notNull(),
  total: decimal("total", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", [
    "cash",
    "terminal",
    "other",
  ]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", [
    "pending",
    "paid",
    "failed",
    "refunded",
  ]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const cafeSaleLines = mysqlTable("cafe_sale_lines", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2 }).notNull(),
});
export const cafePayments = mysqlTable(
  "cafe_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    saleId: int("saleId").notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    providerReference: varchar("providerReference", { length: 200 }).notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("cafe_payment_provider_reference_uq").on(
      t.provider,
      t.providerReference
    ),
  ]
);
export const cafeStockMovements = mysqlTable(
  "cafe_stock_movements",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(),
    fromLocationId: int("fromLocationId"),
    toLocationId: int("toLocationId"),
    reason: varchar("reason", { length: 255 }).notNull(),
    actorId: int("actorId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    referenceType: varchar("referenceType", { length: 40 }),
    referenceId: int("referenceId"),
  },
  t => [index("cafe_stock_movement_product_idx").on(t.productId)]
);
export const cafeCorrections = mysqlTable("cafe_corrections", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  reason: text("reason").notNull(),
  beforeData: json("beforeData").notNull(),
  afterData: json("afterData").notNull(),
  actorId: int("actorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const cafeAudit = mysqlTable(
  "cafe_audit",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId").notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    entity: varchar("entity", { length: 100 }).notNull(),
    entityId: int("entityId"),
    summary: text("summary").notNull(),
    beforeData: json("beforeData"),
    afterData: json("afterData"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [index("cafe_audit_created_idx").on(t.createdAt)]
);
