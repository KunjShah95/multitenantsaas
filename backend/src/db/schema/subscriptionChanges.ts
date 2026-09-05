import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  numeric,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { subscriptions } from "./subscriptions.js";
import { users } from "./users.js";
import { adjustments } from "./adjustments.js";

export const subscriptionChanges = pgTable(
  "subscription_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "restrict" }),
    changeType: varchar("change_type", { length: 32 }).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    previousSnapshot: text("previous_snapshot").notNull(),
    newSnapshot: text("new_snapshot").notNull(),
    prorationNet: numeric("proration_net", { precision: 20, scale: 6 }).notNull().default("0"),
    prorationTax: numeric("proration_tax", { precision: 20, scale: 6 }).notNull().default("0"),
    prorationTotal: numeric("proration_total", { precision: 20, scale: 6 }).notNull().default("0"),
    adjustmentId: uuid("adjustment_id").references(() => adjustments.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscription_changes_tenant_idx").on(t.tenantId),
    index("subscription_changes_subscription_idx").on(t.subscriptionId),
    check(
      "subscription_changes_type_check",
      sql`${t.changeType} IN ('quantity','plan','discount','cancel')`,
    ),
  ],
);
