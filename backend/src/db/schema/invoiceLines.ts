import { pgTable, uuid, text, timestamp, varchar, numeric, integer, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { invoices } from "./invoices.js";
import { orderLines } from "./orderLines.js";

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    orderLineId: uuid("order_line_id").references(() => orderLines.id, { onDelete: "set null" }),
    lineNumber: integer("line_number").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 20, scale: 6 }).notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    taxRatePct: numeric("tax_rate_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    lineSubtotal: numeric("line_subtotal", { precision: 20, scale: 6 }).notNull().default("0"),
    lineDiscount: numeric("line_discount", { precision: 20, scale: 6 }).notNull().default("0"),
    lineNet: numeric("line_net", { precision: 20, scale: 6 }).notNull().default("0"),
    lineTax: numeric("line_tax", { precision: 20, scale: 6 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 20, scale: 6 }).notNull().default("0"),
    immutable: integer("immutable").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoice_lines_tenant_idx").on(t.tenantId),
    index("invoice_lines_invoice_idx").on(t.invoiceId),
    check("invoice_lines_quantity_check", sql`${t.quantity} > 0`),
    check("invoice_lines_discount_check", sql`${t.discountPct} >= 0 AND ${t.discountPct} <= 100`),
    check("invoice_lines_immutable_check", sql`${t.immutable} IN (0,1)`),
    check("invoice_lines_line_number_check", sql`${t.lineNumber} >= 1`),
  ],
);
