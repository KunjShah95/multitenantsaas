import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invitations_tenant_idx").on(t.tenantId),
    uniqueIndex("invitations_tenant_email_pending_unique").on(t.tenantId, t.email),
    check("invitations_role_check", sql`${t.role} IN ('admin','rep','manager','finance','ops')`),
    check("invitations_expires_check", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);
