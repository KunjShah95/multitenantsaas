import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  numeric,
  integer,
  date,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { orders } from "./orders.js";
import { orderLines } from "./orderLines.js";
import { customers } from "./customers.js";
import { subscriptionPlans } from "./subscriptionPlans.js";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLines.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    subscriptionPlanId: uuid("subscription_plan_id").references(() => subscriptionPlans.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    billingInterval: varchar("billing_interval", { length: 32 }).notNull(),
    billingAnchorDate: date("billing_anchor_date").notNull(),
    billingTimezone: varchar("billing_timezone", { length: 64 }).notNull().default("UTC"),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    snapshotPlanCode: varchar("snapshot_plan_code", { length: 64 }),
    snapshotPlanName: text("snapshot_plan_name"),
    snapshotName: text("snapshot_name").notNull(),
    snapshotSku: varchar("snapshot_sku", { length: 64 }).notNull(),
    snapshotUnit: varchar("snapshot_unit", { length: 32 }).notNull(),
    snapshotUnitPrice: numeric("snapshot_unit_price", { precision: 20, scale: 6 }).notNull(),
    snapshotTaxRatePct: numeric("snapshot_tax_rate_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    snapshotCurrency: varchar("snapshot_currency", { length: 3 }).notNull(),
    periodUnitNet: numeric("period_unit_net", { precision: 20, scale: 6 }).notNull(),
    periodUnitTax: numeric("period_unit_tax", { precision: 20, scale: 6 }).notNull(),
    periodUnitTotal: numeric("period_unit_total", { precision: 20, scale: 6 }).notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    nextBillAt: timestamp("next_bill_at", { withTimezone: true }).notNull(),
    cancelPolicy: varchar("cancel_policy", { length: 32 }).notNull().default("credit_remaining"),
    cancelEffectiveAt: timestamp("cancel_effective_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_tenant_order_line_unique").on(t.tenantId, t.orderLineId),
    index("subscriptions_tenant_idx").on(t.tenantId),
    index("subscriptions_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("subscriptions_tenant_status_next_bill_idx").on(t.tenantId, t.status, t.nextBillAt),
    index("subscriptions_order_idx").on(t.orderId),
    check("subscriptions_status_check", sql`${t.status} IN ('active','cancelled','pending')`),
    check(
      "subscriptions_interval_check",
      sql`${t.billingInterval} IN ('monthly','quarterly','yearly')`,
    ),
    check(
      "subscriptions_cancel_policy_check",
      sql`${t.cancelPolicy} IN ('credit_remaining','no_refund','charge_remaining')`,
    ),
    check("subscriptions_quantity_check", sql`${t.quantity} > 0`),
    check("subscriptions_discount_check", sql`${t.discountPct} >= 0 AND ${t.discountPct} <= 100`),
    check("subscriptions_revision_check", sql`${t.revision} >= 1`),
    check("subscriptions_period_end_check", sql`${t.currentPeriodEnd} > ${t.currentPeriodStart}`),
  ],
);
