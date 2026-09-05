import { pgTable, uuid, text, timestamp, varchar, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { users } from "./users.js";
import { alerts } from "./alerts.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recipientRole: varchar("recipient_role", { length: 32 }),
    alertId: uuid("alert_id").references(() => alerts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    deliveryChannel: varchar("delivery_channel", { length: 32 }).notNull().default("in_app"),
    deliveryStatus: varchar("delivery_status", { length: 32 }).notNull().default("pending"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_tenant_idx").on(t.tenantId),
    index("notifications_tenant_recipient_idx").on(t.tenantId, t.recipientUserId, t.readAt),
    index("notifications_tenant_status_idx").on(t.tenantId, t.deliveryStatus),
    check("notifications_channel_check", sql`${t.deliveryChannel} IN ('in_app','email','webhook')`),
    check(
      "notifications_status_check",
      sql`${t.deliveryStatus} IN ('pending','delivered','failed')`,
    ),
  ],
);
