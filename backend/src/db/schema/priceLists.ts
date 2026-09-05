import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { customerTiers } from "./customerTiers.js";

export const priceLists = pgTable(
  "price_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    customerTierId: uuid("customer_tier_id").references(() => customerTiers.id, {
      onDelete: "set null",
    }),
    priority: integer("priority").notNull().default(0),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("price_lists_tenant_idx").on(t.tenantId),
    index("price_lists_tenant_currency_idx").on(t.tenantId, t.currency),
    check("price_lists_name_check", sql`char_length(${t.name}) > 0`),
    check("price_lists_currency_check", sql`char_length(${t.currency}) = 3`),
    check("price_lists_status_check", sql`${t.status} IN ('active','archived')`),
    check(
      "price_lists_effective_check",
      sql`${t.effectiveTo} IS NULL OR ${t.effectiveFrom} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`,
    ),
  ],
);
