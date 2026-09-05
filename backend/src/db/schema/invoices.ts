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
import { orders } from "./orders.js";
import { customers } from "./customers.js";
import { subscriptions } from "./subscriptions.js";

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: varchar("number", { length: 32 }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "restrict" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    invoiceType: varchar("invoice_type", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotal: numeric("subtotal", { precision: 20, scale: 6 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 20, scale: 6 }).notNull().default("0"),
    netTotal: numeric("net_total", { precision: 20, scale: 6 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 20, scale: 6 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 20, scale: 6 }).notNull().default("0"),
    balance: numeric("balance", { precision: 20, scale: 6 }).notNull().default("0"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_tenant_number_unique").on(t.tenantId, t.number),
    index("invoices_tenant_idx").on(t.tenantId),
    index("invoices_tenant_status_due_idx").on(t.tenantId, t.status, t.dueAt),
    index("invoices_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("invoices_order_idx").on(t.orderId),
    check("invoices_number_check", sql`char_length(${t.number}) > 0`),
    check("invoices_currency_check", sql`char_length(${t.currency}) = 3`),
    check(
      "invoices_type_check",
      sql`${t.invoiceType} IN ('one_time','recurring','adjustment')`,
    ),
    check(
      "invoices_status_check",
      sql`${t.status} IN ('draft','issued','partial','paid','void','overdue')`,
    ),
    check("invoices_revision_check", sql`${t.revision} >= 1`),
    check("invoices_balance_check", sql`${t.balance} >= 0`),
  ],
);
