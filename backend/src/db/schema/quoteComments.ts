import { pgTable, uuid, text, timestamp, varchar, integer, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { quotes } from "./quotes.js";
import { quoteLines } from "./quoteLines.js";
import { customerContacts } from "./customerContacts.js";
import { users } from "./users.js";

export const quoteComments = pgTable(
  "quote_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    lineId: uuid("line_id").references(() => quoteLines.id, { onDelete: "set null" }),
    versionNumber: integer("version_number"),
    authorContactId: uuid("author_contact_id").references(() => customerContacts.id, { onDelete: "set null" }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    visibility: varchar("visibility", { length: 32 }).notNull().default("portal_visible"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quote_comments_tenant_idx").on(t.tenantId),
    index("quote_comments_quote_idx").on(t.quoteId),
    index("quote_comments_line_idx").on(t.lineId),
    index("quote_comments_contact_idx").on(t.authorContactId),
    index("quote_comments_created_idx").on(t.createdAt),
    check("quote_comments_body_check", sql`char_length(${t.body}) > 0`),
    check("quote_comments_visibility_check", sql`${t.visibility} IN ('portal_visible','internal')`),
  ],
);
