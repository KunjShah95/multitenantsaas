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
import { products } from "./products.js";

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }),
    attribute: text("attribute").notNull(),
    value: text("value").notNull(),
    extraPrice: numeric("extra_price", { precision: 20, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("product_variants_tenant_idx").on(t.tenantId),
    index("product_variants_product_idx").on(t.productId),
    // sku unique per tenant if provided
    uniqueIndex("product_variants_tenant_sku_unique").on(t.tenantId, t.sku),
    check("product_variants_attr_check", sql`char_length(${t.attribute}) > 0`),
    check("product_variants_value_check", sql`char_length(${t.value}) > 0`),
  ],
);
