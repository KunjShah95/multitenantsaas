import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { quotes } from "./quotes.js";
import { quoteVersions } from "./quoteVersions.js";
import { customers } from "./customers.js";
import { customerContacts } from "./customerContacts.js";
import { users } from "./users.js";

export const quoteShares = pgTable(
  "quote_shares",
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
    contactId: uuid("contact_id")
      .notNull()
      .references(() => customerContacts.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quote_shares_tenant_idx").on(t.tenantId),
    index("quote_shares_quote_idx").on(t.quoteId),
    index("quote_shares_contact_idx").on(t.contactId),
    index("quote_shares_customer_idx").on(t.customerId),
    index("quote_shares_version_idx").on(t.quoteId, t.versionNumber),
    index("quote_shares_expires_idx").on(t.expiresAt),
    // allow idempotent re-share without duplicate active row: unique on quote+contact+version when not revoked is enforced in app; keep a simple unique for duplicate detection via application idempotency
    uniqueIndex("quote_shares_quote_contact_version_unique").on(
      t.quoteId,
      t.contactId,
      t.versionNumber,
    ),
    check("quote_shares_version_check", sql`${t.versionNumber} >= 1`),
  ],
);
