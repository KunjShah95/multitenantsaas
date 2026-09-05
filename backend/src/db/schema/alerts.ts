import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  numeric,
  integer,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    alertType: varchar("alert_type", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 32 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    severity: varchar("severity", { length: 32 }).notNull().default("warning"),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 2 }),
    context: jsonb("context").notNull().default({}),
    sourceTime: timestamp("source_time", { withTimezone: true }).notNull().defaultNow(),
    fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
    nudgedAt: timestamp("nudged_at", { withTimezone: true }),
    nudgeCount: integer("nudge_count").notNull().default(0),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("alerts_tenant_idx").on(t.tenantId),
    index("alerts_tenant_status_idx").on(t.tenantId, t.status),
    index("alerts_tenant_fingerprint_idx").on(t.tenantId, t.fingerprint),
    index("alerts_tenant_entity_idx").on(t.tenantId, t.entityType, t.entityId),
    check(
      "alerts_type_check",
      sql`${t.alertType} IN ('stalled_quote','discount_anomaly','delivery_slippage','overdue_invoice')`,
    ),
    check("alerts_status_check", sql`${t.status} IN ('active','dismissed','resolved')`),
    check("alerts_severity_check", sql`${t.severity} IN ('info','warning','critical')`),
    check("alerts_nudge_count_check", sql`${t.nudgeCount} >= 0`),
  ],
);
