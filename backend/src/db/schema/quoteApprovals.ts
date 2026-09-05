import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { quotes } from "./quotes.js";
import { quoteVersions } from "./quoteVersions.js";
import { users } from "./users.js";

export const quoteApprovals = pgTable(
  "quote_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => quoteVersions.id, { onDelete: "set null" }),
    versionNumber: integer("version_number").notNull(),
    sequence: integer("sequence").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    // decision tracking — immutable once decided
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decision: text("decision"), // approve | reject | returnForRevision | invalidated
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("quote_approvals_quote_version_seq_unique").on(
      t.quoteId,
      t.versionNumber,
      t.sequence,
    ),
    index("quote_approvals_tenant_idx").on(t.tenantId),
    index("quote_approvals_quote_idx").on(t.quoteId),
    index("quote_approvals_quote_version_idx").on(t.quoteId, t.versionNumber),
    index("quote_approvals_pending_idx").on(t.status),
    check("quote_approvals_sequence_check", sql`${t.sequence} >= 1`),
    check(
      "quote_approvals_role_check",
      sql`${t.role} IN ('manager','finance','admin','ops','rep')`,
    ),
    check(
      "quote_approvals_status_check",
      sql`${t.status} IN ('pending','approved','rejected','returned','invalidated','auto_approved')`,
    ),
    check(
      "quote_approvals_decision_check",
      sql`${t.decision} IS NULL OR ${t.decision} IN ('approve','reject','returnForRevision','invalidated')`,
    ),
  ],
);
