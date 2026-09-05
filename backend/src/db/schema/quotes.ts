import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  numeric,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { customers } from "./customers.js";
import { memberships } from "./memberships.js";
import { teams } from "./teams.js";
import { users } from "./users.js";

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: varchar("number", { length: 32 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    ownerMembershipId: uuid("owner_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    revision: integer("revision").notNull().default(1),
    currentVersion: integer("current_version").notNull().default(1),
    subtotal: numeric("subtotal", { precision: 20, scale: 6 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 20, scale: 6 }).notNull().default("0"),
    netTotal: numeric("net_total", { precision: 20, scale: 6 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 20, scale: 6 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 20, scale: 6 }).notNull().default("0"),
    marginTotal: numeric("margin_total", { precision: 20, scale: 6 }),
    marginPct: numeric("margin_pct", { precision: 5, scale: 2 }),
    riskScore: numeric("risk_score", { precision: 20, scale: 6 }),
    riskLevel: varchar("risk_level", { length: 32 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("quotes_tenant_number_unique").on(t.tenantId, t.number),
    index("quotes_tenant_idx").on(t.tenantId),
    index("quotes_tenant_status_updated_idx").on(t.tenantId, t.status, t.updatedAt),
    index("quotes_tenant_owner_idx").on(t.tenantId, t.ownerUserId),
    index("quotes_tenant_team_idx").on(t.tenantId, t.teamId),
    index("quotes_tenant_customer_idx").on(t.tenantId, t.customerId),
    check("quotes_number_check", sql`char_length(${t.number}) > 0`),
    check("quotes_currency_check", sql`char_length(${t.currency}) = 3`),
    check(
      "quotes_status_check",
      sql`${t.status} IN ('draft','submittedForApproval','awaitingApproval','approvedInternal','sharedWithCustomer','underNegotiation','customerAccepted','readyForOrder','converted','cancelled','expired','rejected','returnedForRevision')`,
    ),
    check("quotes_revision_check", sql`${t.revision} >= 1`),
    check("quotes_subtotal_check", sql`${t.subtotal} >= 0`),
    check("quotes_discount_check", sql`${t.discountTotal} >= 0`),
    check("quotes_net_check", sql`${t.netTotal} >= 0`),
    check("quotes_tax_check", sql`${t.taxTotal} >= 0`),
    check("quotes_grand_check", sql`${t.grandTotal} >= 0`),
  ],
);
