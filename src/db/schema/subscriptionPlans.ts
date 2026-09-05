import { pgTable, uuid, text, timestamp, varchar, numeric, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    billingInterval: varchar("billing_interval", { length: 32 }).notNull().default("monthly"),
    price: numeric("price", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("subscription_plans_tenant_code_unique").on(t.tenantId, t.code),
    index("subscription_plans_tenant_idx").on(t.tenantId),
    check("subscription_plans_code_check", sql`char_length(${t.code}) > 0`),
    check("subscription_plans_name_check", sql`char_length(${t.name}) > 0`),
    check("subscription_plans_interval_check", sql`${t.billingInterval} IN ('monthly','quarterly','yearly')`),
    check("subscription_plans_price_check", sql`${t.price} >= 0`),
    check("subscription_plans_currency_check", sql`char_length(${t.currency}) = 3`),
  ],
);
