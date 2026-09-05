import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { warehouses } from "./warehouses.js";

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    onHandQty: numeric("on_hand_qty", { precision: 20, scale: 6 }).notNull().default("0"),
    reservedQty: numeric("reserved_qty", { precision: 20, scale: 6 }).notNull().default("0"),
    allocatedQty: numeric("allocated_qty", { precision: 20, scale: 6 }).notNull().default("0"),
    reorderPoint: numeric("reorder_point", { precision: 20, scale: 6 }),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("inventory_balances_tenant_warehouse_sku_unique").on(
      t.tenantId,
      t.warehouseId,
      t.sku,
    ),
    index("inventory_balances_tenant_idx").on(t.tenantId),
    index("inventory_balances_warehouse_idx").on(t.warehouseId),
    check("inventory_balances_sku_check", sql`char_length(${t.sku}) > 0`),
    check("inventory_balances_onhand_check", sql`${t.onHandQty} >= 0`),
    check("inventory_balances_reserved_check", sql`${t.reservedQty} >= 0`),
    check("inventory_balances_allocated_check", sql`${t.allocatedQty} >= 0`),
  ],
);

// Movements are intentionally minimal for Phase 3 — immutable ledger entries for adjustments only
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    deltaQty: numeric("delta_qty", { precision: 20, scale: 6 }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_movements_tenant_idx").on(t.tenantId),
    index("inventory_movements_warehouse_sku_idx").on(t.warehouseId, t.sku),
  ],
);
