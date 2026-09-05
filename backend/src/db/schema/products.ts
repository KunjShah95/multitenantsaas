import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  numeric,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { productCategories } from "./productCategories.js";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: text("name").notNull(),
    unit: varchar("unit", { length: 32 }).notNull().default("ea"),
    standardPrice: numeric("standard_price", { precision: 20, scale: 6 }).notNull(),
    standardCost: numeric("standard_cost", { precision: 20, scale: 6 }).notNull().default("0"),
    taxRatePct: numeric("tax_rate_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("products_tenant_sku_unique").on(t.tenantId, t.sku),
    index("products_tenant_idx").on(t.tenantId),
    index("products_category_idx").on(t.categoryId),
    check("products_sku_check", sql`char_length(${t.sku}) > 0`),
    check("products_name_check", sql`char_length(${t.name}) > 0`),
    check("products_price_check", sql`${t.standardPrice} >= 0`),
    check("products_cost_check", sql`${t.standardCost} >= 0`),
    check("products_tax_check", sql`${t.taxRatePct} >= 0 AND ${t.taxRatePct} <= 100`),
  ],
);
