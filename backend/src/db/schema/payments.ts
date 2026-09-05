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
import { invoices } from "./invoices.js";
import { users } from "./users.js";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    method: varchar("method", { length: 32 }).notNull().default("manual"),
    reference: varchar("reference", { length: 128 }),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    providerExternalId: varchar("provider_external_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_tenant_idx").on(t.tenantId),
    index("payments_invoice_idx").on(t.invoiceId),
    uniqueIndex("payments_tenant_provider_external_unique").on(t.tenantId, t.providerExternalId),
    check("payments_amount_check", sql`${t.amount} > 0`),
    check("payments_currency_check", sql`char_length(${t.currency}) = 3`),
    check("payments_method_check", sql`${t.method} IN ('manual','provider')`),
  ],
);
