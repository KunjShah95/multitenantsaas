import { pgTable, uuid, timestamp, numeric, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { priceLists } from "./priceLists.js";
import { products } from "./products.js";
import { productVariants } from "./productVariants.js";

export const priceListItems = pgTable(
  "price_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 20, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("price_list_items_list_product_variant_unique").on(
      t.priceListId,
      t.productId,
      t.variantId,
    ),
    index("price_list_items_tenant_idx").on(t.tenantId),
    index("price_list_items_list_idx").on(t.priceListId),
    check("price_list_items_price_check", sql`${t.price} >= 0`),
  ],
);
