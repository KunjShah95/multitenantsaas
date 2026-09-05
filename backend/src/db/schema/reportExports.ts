import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  integer,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const reportExports = pgTable(
  "report_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reportType: varchar("report_type", { length: 32 }).notNull(),
    format: varchar("format", { length: 16 }).notNull(),
    parameters: jsonb("parameters").notNull().default({}),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    rowCount: integer("row_count"),
    fileSizeBytes: integer("file_size_bytes"),
    storageKey: text("storage_key"),
    downloadToken: varchar("download_token", { length: 128 }),
    fileContent: text("file_content"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("report_exports_tenant_idx").on(t.tenantId),
    index("report_exports_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("report_exports_tenant_status_idx").on(t.tenantId, t.status),
    check("report_exports_type_check", sql`${t.reportType} IN ('quotes','orders','sales')`),
    check("report_exports_format_check", sql`${t.format} IN ('csv','json')`),
    check(
      "report_exports_status_check",
      sql`${t.status} IN ('pending','processing','completed','failed')`,
    ),
  ],
);
