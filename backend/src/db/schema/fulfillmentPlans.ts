import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  numeric,
  integer,
  index,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { orders } from "./orders.js";
import { users } from "./users.js";

export const fulfillmentPlans = pgTable(
  "fulfillment_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 32 }).notNull().default("planned"),
    revision: integer("revision").notNull().default(1),
    snapshotTime: timestamp("snapshot_time", { withTimezone: true }).notNull().defaultNow(),
    estimatedCost: numeric("estimated_cost", { precision: 20, scale: 6 }),
    estimatedShipments: integer("estimated_shipments"),
    snapshot: jsonb("snapshot"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("fulfillment_plans_tenant_idx").on(t.tenantId),
    index("fulfillment_plans_order_idx").on(t.orderId),
    index("fulfillment_plans_tenant_order_idx").on(t.tenantId, t.orderId),
    check(
      "fulfillment_plans_status_check",
      sql`${t.status} IN ('draft','planned','reserved','partiallyReserved','backordered','superseded','cancelled')`,
    ),
    check("fulfillment_plans_revision_check", sql`${t.revision} >= 1`),
  ],
);
