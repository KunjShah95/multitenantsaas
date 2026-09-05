import { pgTable, uuid, text, timestamp, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { customerContacts } from "./customerContacts.js";

export const portalMagicLinks = pgTable(
  "portal_magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => customerContacts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("portal_magic_links_tenant_idx").on(t.tenantId),
    index("portal_magic_links_contact_idx").on(t.contactId),
    uniqueIndex("portal_magic_links_token_hash_unique").on(t.tokenHash),
  ],
);

export const portalSessions = pgTable(
  "portal_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => customerContacts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("portal_sessions_tenant_idx").on(t.tenantId),
    index("portal_sessions_contact_idx").on(t.contactId),
  ],
);
