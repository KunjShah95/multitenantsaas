import { pgTable, uuid, text, timestamp, numeric, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { warehouses } from "./warehouses.js";
import { orders } from "./orders.js";
import { orderLines } from "./orderLines.js";
import { fulfillmentAllocations } from "./fulfillmentAllocations.js";

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderLineId: uuid("order_line_id").references(() => orderLines.id, { onDelete: "cascade" }),
    fulfillmentAllocationId: uuid("fulfillment_allocation_id").references(
      () => fulfillmentAllocations.id,
      { onDelete: "cascade" },
    ),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_reservations_tenant_idx").on(t.tenantId),
    index("inventory_reservations_warehouse_sku_idx").on(t.warehouseId, t.sku),
    index("inventory_reservations_order_idx").on(t.orderId),
    index("inventory_reservations_order_line_idx").on(t.orderLineId),
    index("inventory_reservations_allocation_idx").on(t.fulfillmentAllocationId),
    index("inventory_reservations_status_idx").on(t.status),
    index("inventory_reservations_expires_idx").on(t.expiresAt),
    check("inventory_reservations_sku_check", sql`char_length(${t.sku}) > 0`),
    check("inventory_reservations_quantity_check", sql`${t.quantity} > 0`),
    check(
      "inventory_reservations_status_check",
      sql`${t.status} IN ('active','shipped','released','expired')`,
    ),
  ],
);
