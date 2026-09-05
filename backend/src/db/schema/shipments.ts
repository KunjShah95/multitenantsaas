import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  numeric,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { orders } from "./orders.js";
import { orderLines } from "./orderLines.js";
import { warehouses } from "./warehouses.js";
import { users } from "./users.js";
import { inventoryReservations } from "./inventoryReservations.js";

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    number: varchar("number", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("created"),
    carrier: varchar("carrier", { length: 64 }),
    trackingNumber: varchar("tracking_number", { length: 128 }),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shipments_tenant_number_unique").on(t.tenantId, t.number),
    index("shipments_tenant_idx").on(t.tenantId),
    index("shipments_order_idx").on(t.orderId),
    index("shipments_warehouse_idx").on(t.warehouseId),
    check("shipments_number_check", sql`char_length(${t.number}) > 0`),
    check(
      "shipments_status_check",
      sql`${t.status} IN ('created','packing','shipped','delivered','cancelled')`,
    ),
  ],
);

export const shipmentLines = pgTable(
  "shipment_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLines.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").references(() => inventoryReservations.id, {
      onDelete: "set null",
    }),
    sku: text("sku").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shipment_lines_tenant_idx").on(t.tenantId),
    index("shipment_lines_shipment_idx").on(t.shipmentId),
    index("shipment_lines_order_line_idx").on(t.orderLineId),
    check("shipment_lines_sku_check", sql`char_length(${t.sku}) > 0`),
    check("shipment_lines_quantity_check", sql`${t.quantity} > 0`),
  ],
);
