import { pgTable, uuid, text, timestamp, varchar, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("product_categories_tenant_code_unique").on(t.tenantId, t.code),
    index("product_categories_tenant_idx").on(t.tenantId),
    check("product_categories_code_check", sql`char_length(${t.code}) > 0`),
    check("product_categories_name_check", sql`char_length(${t.name}) > 0`),
  ],
);
