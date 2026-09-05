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
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { customers } from "./customers.js";
import { quotes } from "./quotes.js";
import { quoteVersions } from "./quoteVersions.js";
import { users } from "./users.js";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: varchar("number", { length: 32 }).notNull(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "restrict" }),
    quoteVersionId: uuid("quote_version_id").references(() => quoteVersions.id, {
      onDelete: "set null",
    }),
    quoteVersionNumber: integer("quote_version_number").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("orderCreated"),
    revision: integer("revision").notNull().default(1),
    // snapshot of accepted quote version (immutable)
    snapshot: jsonb("snapshot").notNull(),
    subtotal: numeric("subtotal", { precision: 20, scale: 6 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 20, scale: 6 }).notNull().default("0"),
    netTotal: numeric("net_total", { precision: 20, scale: 6 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 20, scale: 6 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 20, scale: 6 }).notNull().default("0"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_tenant_number_unique").on(t.tenantId, t.number),
    uniqueIndex("orders_tenant_quote_version_unique").on(
      t.tenantId,
      t.quoteId,
      t.quoteVersionNumber,
    ),
    index("orders_tenant_idx").on(t.tenantId),
    index("orders_tenant_status_updated_idx").on(t.tenantId, t.status, t.updatedAt),
    index("orders_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("orders_quote_idx").on(t.quoteId),
    check("orders_number_check", sql`char_length(${t.number}) > 0`),
    check("orders_currency_check", sql`char_length(${t.currency}) = 3`),
    check(
      "orders_status_check",
      sql`${t.status} IN ('orderCreated','allocationPlanned','stockReserved','packing','partiallyShipped','shipped','delivered','backordered','cancelled')`,
    ),
    check("orders_revision_check", sql`${t.revision} >= 1`),
    check("orders_quote_version_check", sql`${t.quoteVersionNumber} >= 1`),
  ],
);
