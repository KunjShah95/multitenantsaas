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
import { subscriptions } from "./subscriptions.js";

export const billingJobs = pgTable(
  "billing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    jobType: varchar("job_type", { length: 32 }).notNull().default("recurring_invoice"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("billing_jobs_tenant_idempotency_unique").on(t.tenantId, t.idempotencyKey),
    index("billing_jobs_tenant_status_due_idx").on(t.tenantId, t.status, t.dueAt),
    index("billing_jobs_subscription_idx").on(t.subscriptionId),
    check("billing_jobs_type_check", sql`${t.jobType} IN ('recurring_invoice')`),
    check(
      "billing_jobs_status_check",
      sql`${t.status} IN ('pending','processing','completed','failed')`,
    ),
    check("billing_jobs_attempts_check", sql`${t.attempts} >= 0`),
  ],
);
