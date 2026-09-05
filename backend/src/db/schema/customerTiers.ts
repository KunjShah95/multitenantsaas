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

export const customerTiers = pgTable(
  "customer_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("customer_tiers_tenant_code_unique").on(t.tenantId, t.code),
    index("customer_tiers_tenant_idx").on(t.tenantId),
    check("customer_tiers_code_check", sql`char_length(${t.code}) > 0`),
    check("customer_tiers_name_check", sql`char_length(${t.name}) > 0`),
  ],
);
