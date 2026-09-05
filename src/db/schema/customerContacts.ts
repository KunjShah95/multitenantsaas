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
import { customers } from "./customers.js";

export const customerContacts = pgTable(
  "customer_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customer_contacts_tenant_idx").on(t.tenantId),
    index("customer_contacts_customer_idx").on(t.customerId),
    uniqueIndex("customer_contacts_tenant_email_unique").on(t.tenantId, t.email),
    check("customer_contacts_name_check", sql`char_length(${t.name}) > 0`),
    check("customer_contacts_email_check", sql`${t.email} LIKE '%@%'`),
  ],
);
