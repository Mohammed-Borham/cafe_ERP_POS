import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  cafeAccounts,
  cafeAudit,
  cafeEvents,
  cafeReceivings,
  cafeReceivingLines,
  cafeSales,
  cafeSaleLines,
  cafePayments,
  cafeCorrections,
  cafeLocations,
  cafeProducts,
  cafeRoles,
  cafeStock,
  cafeStockMovements,
  cafeSuppliers,
  cafeWarehouses,
  cafeWorkspaces,
  users,
} from "../drizzle/schema";

export const permissionCatalog = [
  ["dashboard.view", "View dashboard", "Dashboard"],
  ["pos.access", "Access POS", "Sales"],
  ["sales.view", "View sales", "Sales"],
  ["sales.create", "Create sales", "Sales"],
  ["sales.correct", "Correct sales", "Sales"],
  ["payments.view", "View payments", "Payments"],
  ["payments.reconcile", "Reconcile payments", "Payments"],
  ["inventory.view", "View inventory", "Inventory"],
  ["inventory.receive", "Receive inventory", "Inventory"],
  ["inventory.transfer", "Transfer inventory", "Inventory"],
  ["inventory.adjust", "Adjust inventory", "Inventory"],
  ["warehouses.manage", "Manage warehouses", "Inventory"],
  ["products.manage", "Manage products", "Catalog"],
  ["suppliers.manage", "Manage suppliers", "Catalog"],
  ["events.view", "View events", "Events"],
  ["events.manage", "Manage events", "Events"],
  ["events.sell", "Sell at events", "Events"],
  ["users.view", "View staff", "Administration"],
  ["users.manage", "Manage staff", "Administration"],
  ["roles.manage", "Manage roles", "Administration"],
  ["audit.view", "View audit log", "Administration"],
  ["settings.manage", "Manage settings", "Administration"],
].map(([key, label, group]) => ({ key, label, group }));
const allPermissions = permissionCatalog.map(x => x.key);
const denied = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "Café access or required permission is missing",
  });
async function membership(ctx: any, permission?: string) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable",
    });
  const rows = await db
    .select({ account: cafeAccounts, role: cafeRoles })
    .from(cafeAccounts)
    .leftJoin(cafeRoles, eq(cafeAccounts.roleId, cafeRoles.id))
    .where(eq(cafeAccounts.userId, ctx.user.id))
    .limit(1);
  const row = rows[0];
  if (!row || !row.account.active || !row.role) throw denied();
  const owner = Boolean(row.role.isOwner);
  const perms = (row.role.permissions as string[]) || [];
  if (permission && !owner && !perms.includes(permission)) throw denied();
  return { db, owner, perms, role: row.role };
}
async function audit(
  db: any,
  actorId: number,
  action: string,
  entity: string,
  entityId: number | null,
  summary: string,
  beforeData?: unknown,
  afterData?: unknown
) {
  await db.insert(cafeAudit).values({
    actorId,
    action,
    entity,
    entityId,
    summary,
    beforeData: beforeData as any,
    afterData: afterData as any,
  });
}
async function decreaseStock(tx: any, row: any, quantity: number, message: string) {
  const result = await tx
    .update(cafeStock)
    .set({ quantity: sql`${cafeStock.quantity}-${quantity}` })
    .where(and(eq(cafeStock.id, row.id), gte(cafeStock.quantity, String(quantity))));
  const header = (result as any)?.[0] ?? result;
  if (Number(header?.affectedRows ?? header?.rowsAffected ?? 0) !== 1)
    throw new TRPCError({ code: "CONFLICT", message });
}
async function requireProducts(tx: any, productIds: number[]) {
  const ids = [...new Set(productIds)];
  const found = await tx
    .select({ id: cafeProducts.id })
    .from(cafeProducts)
    .where(inArray(cafeProducts.id, ids));
  if (found.length !== ids.length)
    throw new TRPCError({ code: "BAD_REQUEST", message: "One or more products do not exist" });
}
const itemList = z
  .array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().positive(),
      unitCost: z.number().nonnegative().optional(),
    })
  )
  .min(1)
  .refine(items => new Set(items.map(item => item.productId)).size === items.length, {
    message: "Each product can appear only once",
  });
export const cafeRouter = router({
  state: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      });
    const ws = (await db.select().from(cafeWorkspaces).limit(1))[0];
    const ownerExists = Boolean(ws);
    let acct = (
      await db
        .select({ account: cafeAccounts, role: cafeRoles })
        .from(cafeAccounts)
        .leftJoin(cafeRoles, eq(cafeAccounts.roleId, cafeRoles.id))
        .where(eq(cafeAccounts.userId, ctx.user.id))
        .limit(1)
    )[0];
    if (ownerExists && !acct) {
      await db
        .insert(cafeAccounts)
        .values({ userId: ctx.user.id, active: false, roleId: null });
    }
    acct =
      acct ||
      (
        await db
          .select({ account: cafeAccounts, role: cafeRoles })
          .from(cafeAccounts)
          .leftJoin(cafeRoles, eq(cafeAccounts.roleId, cafeRoles.id))
          .where(eq(cafeAccounts.userId, ctx.user.id))
          .limit(1)
      )[0];
    const canInitialize = !ownerExists;
    if (acct?.account.active) {
      const seenAt = new Date();
      await db.update(cafeAccounts).set({ lastSeenAt: seenAt }).where(eq(cafeAccounts.id, acct.account.id));
      acct.account.lastSeenAt = seenAt;
    }
    if (acct?.account.active && ctx.user.lastSignedIn) {
      const loginAt = new Date(ctx.user.lastSignedIn);
      const priorLoginAt = acct.account.lastAuditedLoginAt;
      if (!priorLoginAt || new Date(priorLoginAt).getTime() !== loginAt.getTime()) {
        const claim = await db.update(cafeAccounts)
          .set({ lastAuditedLoginAt: loginAt })
          .where(and(eq(cafeAccounts.id, acct.account.id), priorLoginAt
            ? eq(cafeAccounts.lastAuditedLoginAt, priorLoginAt)
            : isNull(cafeAccounts.lastAuditedLoginAt)));
        const affected = Number((claim as any)?.[0]?.affectedRows ?? (claim as any)?.affectedRows ?? 0);
        if (affected > 0) await audit(db, ctx.user.id, "sign_in", "user", ctx.user.id, "Signed in", null, { loginAt });
      }
    }
    const actor =
      acct?.account.active && acct.role
        ? {
            id: ctx.user.id,
            displayName: ctx.user.name || ctx.user.email || "Staff",
            email: ctx.user.email,
            isOwner: Boolean(acct.role.isOwner),
            roleName: acct.role.name,
            permissions: acct.role.isOwner
              ? allPermissions
              : (acct.role.permissions as string[]),
          }
        : null;
    const empty = {
      products: [],
      warehouses: [],
      suppliers: [],
      sales: [],
      payments: [],
      events: [],
      users: [],
      roles: [],
      audit: [],
      receivings: [],
      stockMovements: [],
    };
    if (!ws)
      return {
        setupRequired: true,
        canInitialize,
        needsAccess: false,
        actor,
        business: null,
        paymentProviderStatus: "not_connected" as const,
        stats: { todaySales: 0, orders: 0, lowStock: 0, openEvents: 0 },
        ...empty,
        permissionCatalog,
      };
    if (!acct?.account.active || !acct.role)
      return {
        setupRequired: false,
        canInitialize: false,
        needsAccess: true,
        actor: null,
        business: null,
        paymentProviderStatus: "not_connected" as const,
        stats: { todaySales: 0, orders: 0, lowStock: 0, openEvents: 0 },
        ...empty,
        permissionCatalog,
      };
    const allowed = actor!.permissions;
    const canUseInventory = actor!.isOwner || ["inventory.view", "inventory.receive", "inventory.transfer", "inventory.adjust", "products.manage", "sales.create", "sales.correct", "events.sell"].some(p => allowed.includes(p));
    const canUseCatalog = actor!.isOwner || ["products.manage", "sales.create", "sales.correct", "events.sell", "inventory.receive", "inventory.transfer", "inventory.adjust", "inventory.view"].some(p => allowed.includes(p));
    const canViewEvents = actor!.isOwner || ["events.view", "events.manage", "events.sell"].some(p => allowed.includes(p));
    const [products, warehouses, suppliers, events, roles] = await Promise.all([
      canUseCatalog ? db.select().from(cafeProducts) : Promise.resolve([]),
      canUseInventory ? db.select().from(cafeWarehouses) : Promise.resolve([]),
      actor!.isOwner || allowed.includes("suppliers.manage") || allowed.includes("inventory.receive")
        ? db.select().from(cafeSuppliers)
        : Promise.resolve([]),
      canViewEvents ? db.select().from(cafeEvents) : Promise.resolve([]),
      actor!.isOwner || allowed.includes("roles.manage")
        ? db.select().from(cafeRoles)
        : Promise.resolve([]),
    ]);
    const salesAllowed = actor!.isOwner || allowed.includes("sales.view") || allowed.includes("sales.correct");
    const paymentsAllowed = actor!.isOwner || allowed.includes("payments.view") || allowed.includes("payments.reconcile");
    const receivingAllowed = actor!.isOwner || allowed.includes("inventory.receive");
    const [salesRows, receivingRows] = await Promise.all([
      salesAllowed ? db.select().from(cafeSales).orderBy(sql`${cafeSales.createdAt} desc`) : Promise.resolve([]),
      receivingAllowed ? db.select().from(cafeReceivings).orderBy(sql`${cafeReceivings.createdAt} desc`).limit(200) : Promise.resolve([]),
    ]);
    const saleIds = salesRows.map((sale: any) => sale.id);
    const receivingIds = receivingRows.map((row: any) => row.id);
    const [saleLines, receivingLines, paymentRows] = await Promise.all([
      saleIds.length ? db.select().from(cafeSaleLines) : Promise.resolve([]),
      receivingIds.length ? db.select().from(cafeReceivingLines) : Promise.resolve([]),
      paymentsAllowed && saleIds.length ? db.select().from(cafePayments) : Promise.resolve([]),
    ]);
    const stock = canUseInventory ? await db.select().from(cafeStock) : [];
    const locations = await db.select().from(cafeLocations);
    const productResult = products.map((p: any) => {
      const entries = stock.filter((s: any) => s.productId === p.id);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        price: Number(p.price),
        unit: p.unit,
        lowStockThreshold: Number(p.lowStockThreshold),
        active: p.active,
        totalStock: entries.reduce(
          (n: number, s: any) => n + Number(s.quantity),
          0
        ),
        stockByLocation: entries.map((s: any) => ({
          locationId: s.locationId,
          locationName: locations.find((l: any) => l.id === s.locationId)?.name || "",
          locationType: locations.find((l: any) => l.id === s.locationId)?.type || "warehouse",
          quantity: Number(s.quantity),
        })),
      };
    });
    const usersList =
      actor!.isOwner || allowed.includes("users.view") || allowed.includes("users.manage")
        ? await db
            .select({ account: cafeAccounts, user: users, role: cafeRoles })
            .from(cafeAccounts)
            .innerJoin(users, eq(cafeAccounts.userId, users.id))
            .leftJoin(cafeRoles, eq(cafeAccounts.roleId, cafeRoles.id))
        : [];
    const warehouseOutput = warehouses.map((w: any) => ({
      id: w.id,
      locationId: w.locationId,
      name: w.name,
      location: w.location,
      active: w.active,
      stock: stock
        .filter((s: any) => s.locationId === w.locationId)
        .map((s: any) => ({
          productId: s.productId,
          productName:
            productResult.find(p => p.id === s.productId)?.name || "",
          quantity: Number(s.quantity),
        })),
    }));
    const eventLocationIds = events.map((e: any) => e.locationId);
    const [eventStockRows, eventMovementRows, eventProductRows, eventSaleRows] =
      canViewEvents && eventLocationIds.length
        ? await Promise.all([
            db.select().from(cafeStock).where(inArray(cafeStock.locationId, eventLocationIds)),
            db.select().from(cafeStockMovements).where(or(
              inArray(cafeStockMovements.fromLocationId, eventLocationIds),
              inArray(cafeStockMovements.toLocationId, eventLocationIds),
            )),
            db.select({ id: cafeProducts.id, name: cafeProducts.name, unit: cafeProducts.unit }).from(cafeProducts),
            db.select({ id: cafeSales.id, eventId: cafeSales.eventId }).from(cafeSales).where(inArray(cafeSales.eventId, events.map((event: any) => event.id))),
          ])
        : [[], [], [], []];
    const eventSaleIds = (eventSaleRows as any[]).map((sale: any) => sale.id);
    const eventCorrectionRows = eventSaleIds.length
      ? await db.select().from(cafeStockMovements).where(and(
          eq(cafeStockMovements.referenceType, "correction"),
          inArray(cafeStockMovements.referenceId, eventSaleIds),
        ))
      : [];
    const productLabel = (id: number) =>
      productResult.find(p => p.id === id)?.name ||
      (eventProductRows as any[]).find(p => p.id === id)?.name ||
      `Product #${id}`;
    const ev = events.map((e: any) => {
      const eventStock = (eventStockRows as any[]).filter((row: any) => row.locationId === e.locationId);
      const directEventMovements = (eventMovementRows as any[]).filter((move: any) =>
        move.fromLocationId === e.locationId || move.toLocationId === e.locationId,
      );
      const saleIdsForEvent = (eventSaleRows as any[]).filter((sale: any) => sale.eventId === e.id).map((sale: any) => sale.id);
      const relatedCorrections = (eventCorrectionRows as any[]).filter((move: any) => saleIdsForEvent.includes(move.referenceId));
      const eventMovements = [...new Map([...directEventMovements, ...relatedCorrections].map((move: any) => [move.id, move])).values()];
      const productIds = [...new Set([
        ...eventStock.map((row: any) => row.productId),
        ...eventMovements.map((move: any) => move.productId),
      ])];
      const reconciliation = productIds.map(productId => {
        const movements = eventMovements.filter((move: any) => move.productId === productId);
        const sent = movements
          .filter((move: any) => move.toLocationId === e.locationId && move.fromLocationId !== null && locations.find((loc: any) => loc.id === move.fromLocationId)?.type !== "event")
          .reduce((sum: number, move: any) => sum + Number(move.quantity), 0);
        const sold = movements
          .filter((move: any) => move.fromLocationId === e.locationId && move.referenceType === "sale")
          .reduce((sum: number, move: any) => sum + Number(move.quantity), 0);
        const correctionOut = movements
          .filter((move: any) => move.fromLocationId === e.locationId && move.referenceType === "correction")
          .reduce((sum: number, move: any) => sum + Number(move.quantity), 0);
        const correctionIn = movements
          .filter((move: any) => move.toLocationId === e.locationId && move.referenceType === "correction")
          .reduce((sum: number, move: any) => sum + Number(move.quantity), 0);
        const netSold = sold + correctionOut - correctionIn;
        const returned = movements
          .filter((move: any) => move.fromLocationId === e.locationId && move.toLocationId !== null && locations.find((loc: any) => loc.id === move.toLocationId)?.type !== "event" && move.referenceType !== "sale")
          .reduce((sum: number, move: any) => sum + Number(move.quantity), 0);
        const adjustedIn = movements
          .filter((move: any) => move.toLocationId === e.locationId && move.fromLocationId === null && !["sale", "correction"].includes(move.referenceType))
          .reduce((sum: number, move: any) => sum + Number(move.quantity), 0);
        const adjustedOut = movements
          .filter((move: any) => move.fromLocationId === e.locationId && move.toLocationId === null && !["sale", "correction"].includes(move.referenceType))
          .reduce((sum: number, move: any) => sum + Number(move.quantity), 0);
        const correctionOutFromReturnedStock = e.returnWarehouseLocationId
          ? movements.filter((move: any) => move.fromLocationId === e.returnWarehouseLocationId && move.toLocationId === null && move.referenceType === "correction").reduce((sum: number, move: any) => sum + Number(move.quantity), 0)
          : 0;
        const correctionBackToReturnedStock = e.returnWarehouseLocationId
          ? movements.filter((move: any) => move.toLocationId === e.returnWarehouseLocationId && move.fromLocationId === null && move.referenceType === "correction").reduce((sum: number, move: any) => sum + Number(move.quantity), 0)
          : 0;
        const adjusted = adjustedIn - adjustedOut + correctionBackToReturnedStock - correctionOutFromReturnedStock;
        const onHand = Number(eventStock.find((row: any) => row.productId === productId)?.quantity || 0);
        return {
          productId,
          name: productLabel(productId),
          unit: (eventProductRows as any[]).find(product => product.id === productId)?.unit || "",
          sent,
          sold: netSold,
          returned,
          adjusted,
          onHand,
          discrepancy: sent + adjusted - sold - returned - onHand,
        };
      });
      return {
        id: e.id,
        locationId: e.locationId,
        name: e.name,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        actorName: "Staff",
        stock: eventStock.map((row: any) => ({
          productId: row.productId,
          name: productLabel(row.productId),
          quantity: Number(row.quantity),
        })),
        reconciliation,
      };
    });
    const allowedAudit =
      actor!.isOwner || allowed.includes("audit.view")
        ? await db
            .select()
            .from(cafeAudit)
            .orderBy(sql`${cafeAudit.createdAt} desc`)
            .limit(100)
        : [];
    const stockMovements = actor!.isOwner || ["inventory.view", "inventory.receive", "inventory.transfer", "inventory.adjust", "sales.correct"].some(p => allowed.includes(p))
      ? await db
          .select()
          .from(cafeStockMovements)
          .orderBy(sql`${cafeStockMovements.createdAt} desc`)
          .limit(100)
      : [];
    const roleOutput = roles.map((r: any) => ({
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
      isOwner: Boolean(r.isOwner),
      permissions: r.isOwner ? allPermissions : r.permissions,
    }));
    const acctNames = new Map(
      usersList.map((x: any) => [
        x.user.id,
        x.user.name || x.user.email || "Staff",
      ])
    );
    const actorNames = new Map<number, string>(acctNames);
    const actorIds = [...new Set([...salesRows.map((x: any) => x.actorId), ...receivingRows.map((x: any) => x.actorId), ...events.map((x: any) => x.actorId), ...allowedAudit.map((x: any) => x.actorId), ...stockMovements.map((x: any) => x.actorId)])];
    if (actorIds.length) {
      const actors = await db.select().from(users);
      for (const user of actors) if (actorIds.includes(user.id)) actorNames.set(user.id, user.name || user.email || "Staff");
    }
    if (!actorNames.has(ctx.user.id)) actorNames.set(ctx.user.id, ctx.user.name || ctx.user.email || "Staff");
    for (const event of ev) {
      const sourceEvent: any = events.find((e: any) => e.id === event.id);
      event.actorName = actorNames.get(sourceEvent?.actorId) || "Staff";
    }
    const saleOutput = salesRows.map((sale: any) => ({
      id: sale.id, invoiceNo: sale.invoiceNo, source: sale.source, eventId: sale.eventId,
      eventName: events.find((e: any) => e.id === sale.eventId)?.name || null,
      actorName: actorNames.get(sale.actorId) || "Staff", total: Number(sale.total),
      paymentMethod: sale.paymentMethod, paymentStatus: sale.paymentStatus, createdAt: sale.createdAt,
      items: saleLines.filter((line: any) => line.saleId === sale.id).map((line: any) => ({
        productId: line.productId, name: line.name, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice),
      })),
      paymentTransactions: paymentsAllowed ? paymentRows.filter((payment: any) => payment.saleId === sale.id).map((payment: any) => ({
        id: payment.id, saleId: payment.saleId, provider: payment.provider, providerReference: payment.providerReference,
        amount: Number(payment.amount), status: payment.status, createdAt: payment.createdAt,
      })) : [],
    }));
    const receivingOutput = receivingRows.map((r: any) => ({
      id: r.id, reference: r.reference, supplierId: r.supplierId, warehouseId: r.warehouseId,
      supplierName: suppliers.find((supplier: any) => supplier.id === r.supplierId)?.name || null,
      warehouseName: warehouseOutput.find((warehouse: any) => warehouse.id === r.warehouseId)?.name || "",
      total: Number(r.total), note: r.note, actorName: actorNames.get(r.actorId) || "Staff", createdAt: r.createdAt,
      items: receivingLines.filter((line: any) => line.receivingId === r.id).map((line: any) => ({
        productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost),
      })),
    }));
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1);
    const todaySalesRows = salesRows.filter((sale: any) => new Date(sale.createdAt) >= startToday && new Date(sale.createdAt) < startTomorrow && sale.paymentStatus !== "refunded");
    const todaySalesTotal = todaySalesRows.reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
    const movementOutput = stockMovements.map((m: any) => ({
      id: m.id,
      productName: productResult.find(p => p.id === m.productId)?.name || "",
      quantity: Number(m.quantity),
      fromName:
        locations.find((l: any) => l.id === m.fromLocationId)?.name || "",
      toName: locations.find((l: any) => l.id === m.toLocationId)?.name || "",
      reason: m.reason,
      createdAt: m.createdAt,
      actorName: actorNames.get(m.actorId) || "Staff",
    }));
    return {
      setupRequired: false,
      canInitialize: false,
      needsAccess: false,
      actor,
      business: {
        businessName: ws.businessName,
        branchName: ws.branchName,
        currency: ws.currency,
        cafeWarehouseId: warehouseOutput[0]?.id || null,
        cafeLocationId:
          locations.find((l: any) => l.type === "cafe")?.id || null,
        cafeLocationName:
          locations.find((l: any) => l.type === "cafe")?.name || null,
      },
      paymentProviderStatus: "not_connected" as const,
      stats: {
        todaySales: salesAllowed ? todaySalesTotal : 0,
        orders: salesAllowed ? todaySalesRows.length : 0,
        lowStock: productResult.filter(
          (p: any) => p.totalStock <= p.lowStockThreshold
        ).length,
        openEvents: events.filter((e: any) => e.status === "open").length,
      },
      products: productResult,
      warehouses: warehouseOutput,
      suppliers: suppliers.map((s: any) => ({
        id: s.id,
        name: s.name,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        active: s.active,
      })),
      sales: saleOutput,
      payments: paymentsAllowed ? paymentRows.map((payment: any) => ({
        id: payment.id, saleId: payment.saleId, provider: payment.provider, providerReference: payment.providerReference,
        amount: Number(payment.amount), status: payment.status, createdAt: payment.createdAt,
      })) : [],
      events: ev,
      users: usersList.map((x: any) => ({
        id: x.user.id,
        displayName: x.user.name || x.user.email || "Staff",
        email: x.user.email,
        active: x.account.active,
        roleId: x.account.roleId,
        roleName: x.role?.name || null,
        lastSignedIn: x.user.lastSignedIn,
        lastSeenAt: x.account.lastSeenAt,
        isOnline: Boolean(x.account.lastSeenAt && Date.now() - new Date(x.account.lastSeenAt).getTime() <= 2 * 60 * 1000),
      })),
      roles: roleOutput,
      audit: allowedAudit.map((a: any) => ({
        id: a.id,
        actorName: actorNames.get(a.actorId) || "Staff",
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        summary: a.summary,
        beforeData: a.beforeData,
        afterData: a.afterData,
        createdAt: a.createdAt,
      })),
      receivings: receivingOutput,
      stockMovements: movementOutput,
      permissionCatalog,
    };
  }),
  initialize: protectedProcedure
    .input(
      z.object({
        businessName: z.string().min(1).max(200),
        branchName: z.string().min(1).max(200),
        currency: z.string().length(3),
        warehouseName: z.string().min(1).max(200),
        cafeLocationName: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.transaction(async tx => {
        if ((await tx.select().from(cafeWorkspaces).limit(1)).length)
          throw denied();
        const [owner] = await tx.insert(cafeRoles).values({
          name: "Owner",
          isSystem: true,
          isOwner: true,
          permissions: allPermissions,
        });
        const [admin] = await tx.insert(cafeRoles).values({
          name: "Admin",
          isSystem: true,
          permissions: allPermissions,
        });
        await tx.insert(cafeRoles).values({
          name: "Barista",
          isSystem: true,
          permissions: [
            "dashboard.view",
            "pos.access",
            "sales.create",
            "inventory.view",
          ],
        });
        await tx.insert(cafeRoles).values({
          name: "Event Staff",
          isSystem: true,
          permissions: ["events.view", "events.sell", "inventory.view"],
        });
        const ownerId = Number((owner as any).insertId);
        const [workspace] = await tx.insert(cafeWorkspaces).values({
          businessName: input.businessName,
          branchName: input.branchName,
          workspaceKey: "drip",
          currency: input.currency.toUpperCase(),
          ownerUserId: ctx.user.id,
        });
        const [loc] = await tx
          .insert(cafeLocations)
          .values({ name: input.warehouseName, type: "warehouse" });
        const warehouseId = Number((loc as any).insertId);
        await tx.insert(cafeWarehouses).values({
          name: input.warehouseName,
          location: input.branchName,
          locationId: warehouseId,
        });
        const [cafeLoc] = await tx
          .insert(cafeLocations)
          .values({ name: input.cafeLocationName, type: "cafe" });
        await tx
          .insert(cafeAccounts)
          .values({ userId: ctx.user.id, roleId: ownerId, active: true });
        await audit(
          tx,
          ctx.user.id,
          "initialize",
          "workspace",
          Number((workspace as any).insertId),
          `Initialized ${input.businessName}`
        );
        return { success: true };
      }).catch((error: any) => {
        if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY" || error?.errno === 1062)
          throw new TRPCError({ code: "CONFLICT", message: "Café workspace has already been initialized" });
        throw error;
      });
    }),
  warehouses: router({
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(200), location: z.string().min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "warehouses.manage");
        return db.transaction(async tx => {
          const [locInsert] = await tx.insert(cafeLocations).values({ name: input.name, type: "warehouse" });
          const locationId = Number((locInsert as any).insertId);
          const [warehouseInsert] = await tx.insert(cafeWarehouses).values({ name: input.name, location: input.location, locationId });
          const id = Number((warehouseInsert as any).insertId);
          await audit(tx, ctx.user.id, "create", "warehouse", id, input.name, null, { id, locationId, name: input.name, location: input.location });
          return { success: true, id, locationId };
        });
      }),
  }),
  catalog: router({
    upsert: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          name: z.string().min(1),
          sku: z.string().min(1),
          category: z.string(),
          price: z.number().nonnegative(),
          unit: z.string().min(1),
          lowStockThreshold: z.number().nonnegative(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "products.manage");
        const productValues = {
          name: input.name,
          sku: input.sku,
          category: input.category,
          price: String(input.price),
          unit: input.unit,
          lowStockThreshold: String(input.lowStockThreshold),
        };
        if (input.id) {
          await db
            .update(cafeProducts)
            .set(productValues)
            .where(eq(cafeProducts.id, input.id));
          await audit(
            db,
            ctx.user.id,
            "update",
            "product",
            input.id,
            input.name
          );
        } else {
          await db.insert(cafeProducts).values(productValues);
          await audit(db, ctx.user.id, "create", "product", null, input.name);
        }
        return { success: true };
      }),
  }),
  suppliers: router({
    upsert: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          name: z.string().min(1),
          contactName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "suppliers.manage");
        if (input.id)
          await db
            .update(cafeSuppliers)
            .set(input)
            .where(eq(cafeSuppliers.id, input.id));
        else await db.insert(cafeSuppliers).values(input);
        await audit(
          db,
          ctx.user.id,
          "upsert",
          "supplier",
          input.id || null,
          input.name
        );
        return { success: true };
      }),
  }),
  inventory: router({
    receive: protectedProcedure
      .input(
        z.object({
          warehouseId: z.number().int(),
          supplierId: z.number().int().positive().optional(),
          reference: z.string().min(1),
          items: itemList,
          note: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "inventory.receive");
        return db.transaction(async tx => {
          const wh = (
            await tx
              .select()
              .from(cafeWarehouses)
              .where(eq(cafeWarehouses.id, input.warehouseId))
              .limit(1)
          )[0];
          if (!wh)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Warehouse not found",
            });
          if (!wh.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Warehouse is inactive" });
          if (input.supplierId) {
            const supplier = (await tx.select().from(cafeSuppliers).where(eq(cafeSuppliers.id, input.supplierId)).limit(1))[0];
            if (!supplier?.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Supplier not found or inactive" });
          }
          await requireProducts(tx, input.items.map(item => item.productId));
          const lines = input.items.map(i => ({
            ...i,
            unitCost: i.unitCost || 0,
          }));
          const total = lines.reduce((s, i) => s + i.quantity * i.unitCost, 0);
          const [r] = await tx
            .insert((await import("../drizzle/schema")).cafeReceivings)
            .values({
              reference: input.reference,
              supplierId: input.supplierId,
              warehouseId: wh.id,
              total: String(total),
              note: input.note,
              actorId: ctx.user.id,
            });
          const rid = Number((r as any).insertId);
          for (const i of lines) {
            await tx
              .insert((await import("../drizzle/schema")).cafeReceivingLines)
              .values({
                receivingId: rid,
                productId: i.productId,
                quantity: String(i.quantity),
                unitCost: String(i.unitCost),
              });
            await tx
              .insert(cafeStock)
              .values({
                locationId: wh.locationId,
                productId: i.productId,
                quantity: String(i.quantity),
              })
              .onDuplicateKeyUpdate({
                set: { quantity: sql`${cafeStock.quantity}+${i.quantity}` },
              });
            await tx.insert(cafeStockMovements).values({
              productId: i.productId,
              quantity: String(i.quantity),
              fromLocationId: null,
              toLocationId: wh.locationId,
              reason: `Receiving ${input.reference}`,
              actorId: ctx.user.id,
              referenceType: "receiving",
              referenceId: rid,
            });
          }
          await audit(
            tx,
            ctx.user.id,
            "receive",
            "receiving",
            rid,
            input.reference
          );
          return { success: true, id: rid };
        });
      }),
    transfer: protectedProcedure
      .input(
        z.object({
          sourceType: z.enum(["warehouse", "event", "cafe"]),
          sourceId: z.number(),
          destinationType: z.enum(["warehouse", "event", "cafe"]),
          destinationId: z.number(),
          items: itemList,
          note: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "inventory.transfer");
        return db.transaction(async tx => {
          const source = (
            await tx
              .select()
              .from(cafeLocations)
              .where(
                and(
                  eq(cafeLocations.id, input.sourceId),
                  eq(cafeLocations.type, input.sourceType)
                )
              )
              .limit(1)
          )[0];
          const dest = (
            await tx
              .select()
              .from(cafeLocations)
              .where(
                and(
                  eq(cafeLocations.id, input.destinationId),
                  eq(cafeLocations.type, input.destinationType)
                )
              )
              .limit(1)
          )[0];
          if (!source || !dest || source.id === dest.id || !source.active || !dest.active || (source.type === "event" && dest.type === "event"))
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid locations",
            });
          for (const eventLocation of [source, dest].filter((location: any) => location.type === "event")) {
            const event = (await tx.select().from(cafeEvents).where(eq(cafeEvents.locationId, eventLocation.id)).limit(1).for("update"))[0];
            if (!event || event.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Event location is closed" });
          }
          await requireProducts(tx, input.items.map(item => item.productId));
          for (const i of input.items) {
            const row = (
              await tx
                .select()
                .from(cafeStock)
                .where(
                  and(
                    eq(cafeStock.locationId, source.id),
                    eq(cafeStock.productId, i.productId)
                  )
                )
                .limit(1)
                .for("update")
            )[0];
            if (!row || Number(row.quantity) < i.quantity)
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Insufficient source stock",
              });
            await decreaseStock(tx, row, i.quantity, "Stock changed during transfer; refresh and try again");
            await tx
              .insert(cafeStock)
              .values({
                locationId: dest.id,
                productId: i.productId,
                quantity: String(i.quantity),
              })
              .onDuplicateKeyUpdate({
                set: { quantity: sql`${cafeStock.quantity}+${i.quantity}` },
              });
            await tx.insert(cafeStockMovements).values({
              productId: i.productId,
              quantity: String(i.quantity),
              fromLocationId: source.id,
              toLocationId: dest.id,
              reason: input.note || "Transfer",
              actorId: ctx.user.id,
            });
          }
          await audit(
            tx,
            ctx.user.id,
            "transfer",
            "stock",
            null,
            "Stock transferred"
          );
          return { success: true };
        });
      }),
    adjust: protectedProcedure
      .input(
        z.object({
          locationType: z.enum(["warehouse", "event", "cafe"]),
          locationId: z.number().int().positive(),
          productId: z.number().int().positive(),
          newOnHand: z.number().nonnegative(),
          reason: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "inventory.adjust");
        return db.transaction(async tx => {
          const loc = (
            await tx
              .select()
              .from(cafeLocations)
              .where(
                and(
                  eq(cafeLocations.id, input.locationId),
                  eq(cafeLocations.type, input.locationType)
                )
              )
              .limit(1)
          )[0];
          if (!loc || !loc.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Location not found or inactive" });
          if (input.locationType === "event") {
            const event = (await tx.select().from(cafeEvents).where(eq(cafeEvents.locationId, loc.id)).limit(1).for("update"))[0];
            if (!event || event.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Event location is closed" });
          }
          await requireProducts(tx, [input.productId]);
          const st = (
            await tx
              .select()
              .from(cafeStock)
              .where(
                and(
                  eq(cafeStock.locationId, loc.id),
                  eq(cafeStock.productId, input.productId)
                )
              )
              .limit(1)
              .for("update")
          )[0];
          const old = Number(st?.quantity || 0),
            diff = input.newOnHand - old;
          if (st)
            await tx
              .update(cafeStock)
              .set({ quantity: String(input.newOnHand) })
              .where(eq(cafeStock.id, st.id));
          else
            await tx.insert(cafeStock).values({
              locationId: loc.id,
              productId: input.productId,
              quantity: String(input.newOnHand),
            });
          await tx.insert(cafeStockMovements).values({
            productId: input.productId,
            quantity: String(Math.abs(diff)),
            fromLocationId: diff < 0 ? loc.id : null,
            toLocationId: diff > 0 ? loc.id : null,
            reason: input.reason,
            actorId: ctx.user.id,
          });
          await audit(
            tx,
            ctx.user.id,
            "adjust",
            "stock",
            input.productId,
            input.reason,
            { oldOnHand: old },
            { newOnHand: input.newOnHand }
          );
          return { success: true };
        });
      }),
  }),
  events: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          location: z.string().min(1),
          startDate: z.string(),
          endDate: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "events.manage");
        const [l] = await db
          .insert(cafeLocations)
          .values({ name: input.name, type: "event" });
        const locId = Number((l as any).insertId);
        await db.insert(cafeEvents).values({
          name: input.name,
          location: input.location,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : null,
          status: "open",
          locationId: locId,
          actorId: ctx.user.id,
        });
        await audit(db, ctx.user.id, "create", "event", locId, input.name);
        return { success: true };
      }),
    close: protectedProcedure
      .input(
        z.object({
          eventId: z.number(),
          returnWarehouseId: z.number(),
          items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().positive() })),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "events.manage");
        return db.transaction(async tx => {
          const ev = (
              await tx
                .select()
                .from(cafeEvents)
                .where(eq(cafeEvents.id, input.eventId))
                .limit(1)
                .for("update")
            )[0],
            wh = (
              await tx
                .select()
                .from(cafeWarehouses)
                .where(eq(cafeWarehouses.id, input.returnWarehouseId))
                .limit(1)
            )[0];
          if (!ev || ev.status !== "open" || !wh)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid event or warehouse",
            });
          const eventStock = await tx.select().from(cafeStock).where(eq(cafeStock.locationId, ev.locationId)).for("update");
          const requested = new Map<number, number>();
          for (const item of input.items) requested.set(item.productId, (requested.get(item.productId) || 0) + item.quantity);
          for (const row of eventStock) {
            if (Number(row.quantity) > 0 && Math.abs((requested.get(row.productId) || 0) - Number(row.quantity)) > 0.0005)
              throw new TRPCError({ code: "BAD_REQUEST", message: "Return all available event stock before closing; reconcile discrepancies with an inventory adjustment first." });
          }
          for (const i of input.items) {
            const st = (
              await tx
                .select()
                .from(cafeStock)
                .where(
                  and(
                    eq(cafeStock.locationId, ev.locationId),
                    eq(cafeStock.productId, i.productId)
                  )
                )
                .limit(1)
                .for("update")
            )[0];
            if (!st || Number(st.quantity) < i.quantity)
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Return exceeds event stock",
              });
            await decreaseStock(tx, st, i.quantity, "Event stock changed while closing; refresh and reconcile again");
            await tx
              .insert(cafeStock)
              .values({
                locationId: wh.locationId,
                productId: i.productId,
                quantity: String(i.quantity),
              })
              .onDuplicateKeyUpdate({
                set: { quantity: sql`${cafeStock.quantity}+${i.quantity}` },
              });
            await tx.insert(cafeStockMovements).values({
              productId: i.productId,
              quantity: String(i.quantity),
              fromLocationId: ev.locationId,
              toLocationId: wh.locationId,
              reason: "Event return",
              actorId: ctx.user.id,
            });
          }
          await tx
            .update(cafeEvents)
            .set({ status: "closed", returnWarehouseLocationId: wh.locationId })
            .where(eq(cafeEvents.id, ev.id));
          await audit(
            tx,
            ctx.user.id,
            "close",
            "event",
            ev.id,
            "Returned event stock and closed event"
          );
          return { success: true };
        });
      }),
  }),
  sales: {
    create: protectedProcedure
      .input(
        z.object({
          source: z.enum(["cafe", "event"]),
          eventId: z.number().optional(),
          items: itemList,
          paymentMethod: z.enum(["cash", "terminal", "other"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(
          ctx,
          input.source === "cafe" ? "sales.create" : "events.sell"
        );
        if (input.source === "event" && !input.eventId)
          throw new TRPCError({ code: "BAD_REQUEST", message: "An event is required for event sales" });
        const selectedEvent = input.source === "event"
          ? (await db.select().from(cafeEvents).where(eq(cafeEvents.id, input.eventId!)).limit(1))[0]
          : null;
        if (input.source === "event" && (!selectedEvent || selectedEvent.status !== "open"))
          throw new TRPCError({ code: "BAD_REQUEST", message: "Event not found or closed" });
        const loc =
          input.source === "event"
            ? selectedEvent?.locationId
            : (
                await db
                  .select()
                  .from(cafeLocations)
                  .where(eq(cafeLocations.type, "cafe"))
                  .limit(1)
              )[0]?.id;
        if (!loc)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sales location unavailable",
          });
        return db.transaction(async tx => {
          if (input.source === "event") {
            const currentEvent = (await tx.select().from(cafeEvents).where(eq(cafeEvents.id, input.eventId!)).limit(1).for("update"))[0];
            if (!currentEvent || currentEvent.status !== "open")
              throw new TRPCError({ code: "BAD_REQUEST", message: "Event not found or closed" });
          }
          let total = 0;
          const lines: any[] = [];
          for (const i of input.items) {
            const p = (
                await tx
                  .select()
                  .from(cafeProducts)
                  .where(eq(cafeProducts.id, i.productId))
                  .limit(1)
                  .for("update")
              )[0],
              st = (
                await tx
                  .select()
                  .from(cafeStock)
                  .where(
                    and(
                      eq(cafeStock.locationId, loc),
                      eq(cafeStock.productId, i.productId)
                    )
                  )
                  .limit(1)
                  .for("update")
              )[0];
            if (!p?.active || !st || Number(st.quantity) < i.quantity)
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Product unavailable or insufficient stock",
              });
            total += Number(p.price) * i.quantity;
            lines.push({ p, q: i.quantity, st });
          }
          const inv = `DR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          const [s] = await tx
            .insert(cafeSales)
            .values({
              invoiceNo: inv,
              source: input.source,
              eventId: input.source === "event" ? input.eventId : null,
              actorId: ctx.user.id,
              total: total.toFixed(2),
              paymentMethod: input.paymentMethod,
              paymentStatus:
                input.paymentMethod === "cash" ? "paid" : "pending",
            });
          const sid = Number((s as any).insertId);
          for (const x of lines) {
            await tx
              .insert(cafeSaleLines)
              .values({
                saleId: sid,
                productId: x.p.id,
                name: x.p.name,
                quantity: String(x.q),
                unitPrice: x.p.price,
              });
            await decreaseStock(tx, x.st, x.q, "Stock changed during checkout; refresh and try again");
            await tx.insert(cafeStockMovements).values({
              productId: x.p.id,
              quantity: String(x.q),
              fromLocationId: loc,
              toLocationId: null,
              reason: `Sale ${inv}`,
              actorId: ctx.user.id,
              referenceType: "sale",
              referenceId: sid,
            });
          }
          await tx.insert(cafePayments).values({
            saleId: sid,
            provider: input.paymentMethod === "cash" ? "cash" : "pending/not_connected",
            providerReference: inv,
            amount: total.toFixed(2),
            status: input.paymentMethod === "cash" ? "paid" : "pending",
          });
          await audit(tx, ctx.user.id, "create", "sale", sid, inv);
          return { success: true, id: sid, invoiceNo: inv };
        });
      }),
    correct: protectedProcedure
      .input(
        z.object({
          saleId: z.number(),
          reason: z.string().min(1),
          items: itemList,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "sales.correct");
        return db.transaction(async tx => {
          const sale = (await tx.select().from(cafeSales).where(eq(cafeSales.id, input.saleId)).limit(1).for("update"))[0];
          if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
          const oldLines = await tx.select().from(cafeSaleLines).where(eq(cafeSaleLines.saleId, sale.id));
          let loc: number | undefined;
          if (sale.source === "event") {
            const event = (await tx.select().from(cafeEvents).where(eq(cafeEvents.id, sale.eventId || 0)).limit(1).for("update"))[0];
            if (!event) throw new TRPCError({ code: "BAD_REQUEST", message: "Sale event not found" });
            loc = event.status === "open" ? event.locationId : event.returnWarehouseLocationId || undefined;
            if (event.status === "closed" && loc) {
              const returnLocation = (await tx.select().from(cafeLocations).where(eq(cafeLocations.id, loc)).limit(1))[0];
              if (!returnLocation?.active || returnLocation.type !== "warehouse")
                throw new TRPCError({ code: "BAD_REQUEST", message: "Event return warehouse is unavailable" });
            }
          } else {
            loc = (await tx.select().from(cafeLocations).where(eq(cafeLocations.type, "cafe")).limit(1))[0]?.id;
          }
          if (!loc) throw new TRPCError({ code: "BAD_REQUEST", message: "Sale stock location unavailable" });
          const before = { sale: { id: sale.id, invoiceNo: sale.invoiceNo, total: Number(sale.total), paymentStatus: sale.paymentStatus }, items: oldLines.map((x: any) => ({ productId:x.productId,name:x.name,quantity:Number(x.quantity),unitPrice:Number(x.unitPrice) })) };
          const oldByProduct = new Map<number, any>(oldLines.map((x: any) => [x.productId, x]));
          const nextLines: any[] = []; let total = 0;
          for (const item of input.items) {
            const old: any = oldByProduct.get(item.productId);
            const product = old ? null : (await tx.select().from(cafeProducts).where(eq(cafeProducts.id,item.productId)).limit(1))[0];
            if (!old && !product?.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown or inactive product" });
            const unitPrice = Number(old?.unitPrice ?? product!.price);
            nextLines.push({ productId:item.productId, name:old?.name ?? product!.name, quantity:item.quantity, unitPrice });
            total += item.quantity * unitPrice;
          }
          for (const productId of new Set([...oldByProduct.keys(), ...nextLines.map(x=>x.productId)])) {
            const old:any = oldByProduct.get(productId), next:any = nextLines.find(x=>x.productId===productId);
            const delta = Number(next?.quantity || 0) - Number(old?.quantity || 0);
            if (!delta) continue;
            const st = (await tx.select().from(cafeStock).where(and(eq(cafeStock.locationId,loc),eq(cafeStock.productId,productId))).limit(1).for("update"))[0];
            if (delta > 0 && (!st || Number(st.quantity) < delta)) throw new TRPCError({ code:"BAD_REQUEST", message:"Insufficient stock for increased corrected quantity" });
            if (st && delta > 0) await decreaseStock(tx, st, delta, "Stock changed during invoice correction; refresh and try again");
            else if (st && delta < 0) await tx.update(cafeStock).set({quantity: sql`${cafeStock.quantity}+${-delta}`}).where(eq(cafeStock.id,st.id));
            else await tx.insert(cafeStock).values({locationId:loc,productId,quantity:String(-delta)});
            await tx.insert(cafeStockMovements).values({productId,quantity:String(Math.abs(delta)),fromLocationId:delta>0?loc:null,toLocationId:delta<0?loc:null,reason:`Correction ${sale.invoiceNo}`,actorId:ctx.user.id,referenceType:"correction",referenceId:sale.id});
          }
          await tx.delete(cafeSaleLines).where(eq(cafeSaleLines.saleId,sale.id));
          for (const line of nextLines) await tx.insert(cafeSaleLines).values({saleId:sale.id,productId:line.productId,name:line.name,quantity:String(line.quantity),unitPrice:String(line.unitPrice)});
          const totalText = total.toFixed(2), changed = totalText !== Number(sale.total).toFixed(2);
          const nextStatus = changed && (sale.paymentStatus === "paid" || sale.paymentStatus === "pending") ? "pending" : sale.paymentStatus;
          await tx.update(cafeSales).set({total:totalText,paymentStatus:nextStatus}).where(eq(cafeSales.id,sale.id));
          if (changed && (sale.paymentStatus === "paid" || sale.paymentStatus === "pending")) await tx.insert(cafePayments).values({saleId:sale.id,provider:"pending/not_connected",providerReference:`${sale.invoiceNo}-adjust-${Date.now()}`,amount:Math.abs(total - Number(sale.total)).toFixed(2),status:"pending"});
          const after = { sale:{id:sale.id,invoiceNo:sale.invoiceNo,total,paymentStatus:nextStatus},items:nextLines };
          await tx.insert(cafeCorrections).values({saleId:sale.id,reason:input.reason,beforeData:before as any,afterData:after as any,actorId:ctx.user.id});
          await audit(tx,ctx.user.id,"correct","sale",sale.id,input.reason,before,after);
          return {success:true};
        });
      }),
  },
  payments: {
    record: protectedProcedure
      .input(
        z.object({
          saleId: z.number(),
          provider: z.string().min(1),
          providerReference: z.string().min(1),
          amount: z.number().nonnegative(),
          status: z.enum(["pending", "paid", "failed", "refunded"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "payments.reconcile");
        await db.transaction(async tx => {
          const sale = (await tx.select().from(cafeSales).where(eq(cafeSales.id, input.saleId)).limit(1).for("update"))[0];
          if (!sale) throw new TRPCError({ code: "NOT_FOUND" });
          if (["paid", "refunded"].includes(input.status) && Math.abs(input.amount - Number(sale.total)) > 0.005)
            throw new TRPCError({ code: "BAD_REQUEST", message: "Reconciled payment amount must match the current invoice total" });
          await tx
            .insert(cafePayments)
            .values({
              saleId: input.saleId,
              provider: input.provider,
              providerReference: input.providerReference,
              amount: String(input.amount),
              status: input.status,
            });
          await tx
            .update(cafeSales)
            .set({ paymentStatus: input.status })
            .where(
              eq(cafeSales.id, input.saleId)
            );
          await audit(
            tx,
            ctx.user.id,
            "reconcile",
            "payment",
            input.saleId,
            `${input.provider} ${input.status}`
          );
        });
        return { success: true };
      }),
  },
  users: {
    setAccess: protectedProcedure
      .input(
        z.object({
          userId: z.number(),
          roleId: z.number().nullable(),
          active: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db, owner } = await membership(ctx, "users.manage");
        if (input.active && input.roleId === null)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a role before enabling this account" });
        if (input.roleId !== null) {
          const assignedRole = (await db.select().from(cafeRoles).where(eq(cafeRoles.id, input.roleId)).limit(1))[0];
          if (!assignedRole || assignedRole.isOwner) throw denied();
        }
        const target = (
          await db
            .select({ account: cafeAccounts, role: cafeRoles })
            .from(cafeAccounts)
            .leftJoin(cafeRoles, eq(cafeAccounts.roleId, cafeRoles.id))
            .where(eq(cafeAccounts.userId, input.userId))
            .limit(1)
        )[0];
        if (target?.role?.isOwner) throw denied();
        const before = target ? { roleId: target.account.roleId, active: target.account.active } : null;
        if (!target)
          await db.insert(cafeAccounts).values({
            userId: input.userId,
            roleId: input.roleId,
            active: input.active,
          });
        else
          await db
            .update(cafeAccounts)
            .set({ roleId: input.roleId, active: input.active })
            .where(eq(cafeAccounts.userId, input.userId));
        await audit(
          db,
          ctx.user.id,
          "set_access",
          "user",
          input.userId,
          "Updated staff access",
          before,
          { roleId: input.roleId, active: input.active }
        );
        return { success: true };
      }),
  },
  roles: {
    upsert: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          name: z.string().min(1),
          permissions: z.array(z.string()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { db } = await membership(ctx, "roles.manage");
        if (input.permissions.some(p => !allPermissions.includes(p)))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unknown permission",
          });
        if (input.id) {
          const role = (
            await db
              .select()
              .from(cafeRoles)
              .where(eq(cafeRoles.id, input.id))
              .limit(1)
          )[0];
          if (!role || role.isOwner) throw denied();
          await db
            .update(cafeRoles)
            .set({ name: input.name, permissions: input.permissions })
            .where(eq(cafeRoles.id, input.id));
        } else
          await db
            .insert(cafeRoles)
            .values({ name: input.name, permissions: input.permissions });
        await audit(
          db,
          ctx.user.id,
          "upsert",
          "role",
          input.id || null,
          input.name
        );
        return { success: true };
      }),
  },
});
