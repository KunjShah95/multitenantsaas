import { pgTable, uuid, text, timestamp, varchar, numeric, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    location: text("location"),
    shippingCostWeight: numeric("shipping_cost_weight", { precision: 10, scale: 4 }).notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("warehouses_tenant_code_unique").on(t.tenantId, t.code),
    index("warehouses_tenant_idx").on(t.tenantId),
    check("warehouses_code_check", sql`char_length(${t.code}) > 0`),
    check("warehouses_name_check", sql`char_length(${t.name}) > 0`),
    check("warehouses_weight_check", sql`${t.shippingCostWeight} >= 0`),
  ],
);
