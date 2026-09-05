import { pgTable, uuid, text, timestamp, varchar, numeric, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { subscriptions } from "./subscriptions.js";
import { invoices } from "./invoices.js";

export const adjustments = pgTable(
  "adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    adjustmentType: varchar("adjustment_type", { length: 32 }).notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    reason: text("reason"),
    reference: varchar("reference", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("adjustments_tenant_idx").on(t.tenantId),
    index("adjustments_subscription_idx").on(t.subscriptionId),
    index("adjustments_invoice_idx").on(t.invoiceId),
    check(
      "adjustments_type_check",
      sql`${t.adjustmentType} IN ('debit','credit','refund')`,
    ),
    check("adjustments_amount_check", sql`${t.amount} > 0`),
    check("adjustments_currency_check", sql`char_length(${t.currency}) = 3`),
  ],
);
