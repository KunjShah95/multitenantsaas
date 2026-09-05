import { pgTable, uuid, text, timestamp, integer, jsonb, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { quotes } from "./quotes.js";
import { quoteVersions } from "./quoteVersions.js";
import { customerContacts } from "./customerContacts.js";
import { customers } from "./customers.js";
import { users } from "./users.js";

export const negotiationRequests = pgTable(
  "negotiation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    baseVersionId: uuid("base_version_id").references(() => quoteVersions.id, { onDelete: "set null" }),
    baseVersionNumber: integer("base_version_number").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => customerContacts.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    requestedChanges: jsonb("requested_changes").notNull(),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    resolutionMessage: text("resolution_message"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    revisionCreated: integer("revision_created"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("negotiation_requests_tenant_idx").on(t.tenantId),
    index("negotiation_requests_quote_idx").on(t.quoteId),
    index("negotiation_requests_contact_idx").on(t.contactId),
    index("negotiation_requests_status_idx").on(t.status),
    index("negotiation_requests_created_idx").on(t.createdAt),
    check("negotiation_requests_version_check", sql`${t.baseVersionNumber} >= 1`),
    check("negotiation_requests_status_check", sql`${t.status} IN ('pending','declined','clarification_requested','accepted_as_revision','superseded')`),
  ],
);
