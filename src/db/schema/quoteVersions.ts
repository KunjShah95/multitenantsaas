import { pgTable, uuid, timestamp, integer, jsonb, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { quotes } from "./quotes.js";

export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("quote_versions_quote_version_unique").on(t.quoteId, t.versionNumber),
    index("quote_versions_tenant_idx").on(t.tenantId),
    index("quote_versions_quote_idx").on(t.quoteId),
    check("quote_versions_version_check", sql`${t.versionNumber} >= 1`),
    check("quote_versions_revision_check", sql`${t.revision} >= 1`),
  ],
);
