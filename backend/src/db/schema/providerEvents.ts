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

export const providerEvents = pgTable(
  "provider_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    externalEventId: varchar("external_event_id", { length: 128 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("provider_events_tenant_provider_external_unique").on(
      t.tenantId,
      t.provider,
      t.externalEventId,
    ),
    index("provider_events_tenant_idx").on(t.tenantId),
    check("provider_events_provider_check", sql`char_length(${t.provider}) > 0`),
    check("provider_events_external_check", sql`char_length(${t.externalEventId}) > 0`),
  ],
);
