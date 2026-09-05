import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  numeric,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { quotes } from "./quotes.js";
import { products } from "./products.js";
import { productVariants } from "./productVariants.js";
import { subscriptionPlans } from "./subscriptionPlans.js";

export const quoteLines = pgTable(
  "quote_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    subscriptionPlanId: uuid("subscription_plan_id").references(() => subscriptionPlans.id, {
      onDelete: "set null",
    }),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    billingType: varchar("billing_type", { length: 32 }).notNull().default("one_time"),
    // Snapshots
    snapshotName: text("snapshot_name").notNull(),
    snapshotSku: varchar("snapshot_sku", { length: 64 }).notNull(),
    snapshotVariantSku: varchar("snapshot_variant_sku", { length: 64 }),
    snapshotCategoryId: uuid("snapshot_category_id"),
    snapshotCategoryCode: varchar("snapshot_category_code", { length: 64 }),
    snapshotUnit: varchar("snapshot_unit", { length: 32 }).notNull(),
    snapshotUnitPrice: numeric("snapshot_unit_price", { precision: 20, scale: 6 }).notNull(),
    snapshotUnitCost: numeric("snapshot_unit_cost", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    snapshotTaxRatePct: numeric("snapshot_tax_rate_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    snapshotCurrency: varchar("snapshot_currency", { length: 3 }).notNull(),
    // Computed totals per line
    lineSubtotal: numeric("line_subtotal", { precision: 20, scale: 6 }).notNull().default("0"),
    lineDiscount: numeric("line_discount", { precision: 20, scale: 6 }).notNull().default("0"),
    lineNet: numeric("line_net", { precision: 20, scale: 6 }).notNull().default("0"),
    lineTax: numeric("line_tax", { precision: 20, scale: 6 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 20, scale: 6 }).notNull().default("0"),
    lineMargin: numeric("line_margin", { precision: 20, scale: 6 }),
    lineMarginPct: numeric("line_margin_pct", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quote_lines_tenant_idx").on(t.tenantId),
    index("quote_lines_quote_idx").on(t.quoteId),
    index("quote_lines_product_idx").on(t.productId),
    check("quote_lines_quantity_check", sql`${t.quantity} > 0`),
    check("quote_lines_discount_check", sql`${t.discountPct} >= 0 AND ${t.discountPct} <= 100`),
    check(
      "quote_lines_tax_check",
      sql`${t.snapshotTaxRatePct} >= 0 AND ${t.snapshotTaxRatePct} <= 100`,
    ),
    check("quote_lines_unitprice_check", sql`${t.snapshotUnitPrice} >= 0`),
    check("quote_lines_unitcost_check", sql`${t.snapshotUnitCost} >= 0`),
    check("quote_lines_billing_check", sql`${t.billingType} IN ('one_time','recurring')`),
    check("quote_lines_line_subtotal_check", sql`${t.lineSubtotal} >= 0`),
    check("quote_lines_line_net_check", sql`${t.lineNet} >= 0`),
    check("quote_lines_line_tax_check", sql`${t.lineTax} >= 0`),
    check("quote_lines_line_total_check", sql`${t.lineTotal} >= 0`),
  ],
);
