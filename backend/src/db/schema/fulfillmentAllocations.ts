import { pgTable, uuid, text, timestamp, varchar, numeric, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { fulfillmentPlans } from "./fulfillmentPlans.js";
import { orderLines } from "./orderLines.js";
import { warehouses } from "./warehouses.js";
import { products } from "./products.js";
import { productVariants } from "./productVariants.js";

export const fulfillmentAllocations = pgTable(
  "fulfillment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fulfillmentPlanId: uuid("fulfillment_plan_id")
      .notNull()
      .references(() => fulfillmentPlans.id, { onDelete: "cascade" }),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLines.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    requestedQty: numeric("requested_qty", { precision: 20, scale: 6 }).notNull(),
    allocatedQty: numeric("allocated_qty", { precision: 20, scale: 6 }).notNull().default("0"),
    backorderedQty: numeric("backordered_qty", { precision: 20, scale: 6 }).notNull().default("0"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("fulfillment_allocations_tenant_idx").on(t.tenantId),
    index("fulfillment_allocations_plan_idx").on(t.fulfillmentPlanId),
    index("fulfillment_allocations_order_line_idx").on(t.orderLineId),
    index("fulfillment_allocations_warehouse_idx").on(t.warehouseId),
    index("fulfillment_allocations_product_idx").on(t.productId),
    check("fulfillment_allocations_sku_check", sql`char_length(${t.sku}) > 0`),
    check("fulfillment_allocations_requested_check", sql`${t.requestedQty} > 0`),
    check("fulfillment_allocations_allocated_check", sql`${t.allocatedQty} >= 0`),
    check("fulfillment_allocations_backordered_check", sql`${t.backorderedQty} >= 0`),
  ],
);
