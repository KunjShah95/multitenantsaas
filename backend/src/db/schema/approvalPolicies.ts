import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  varchar,
  boolean,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";

export const approvalPolicies = pgTable(
  "approval_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 64 }),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    revision: integer("revision").notNull().default(1),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("approval_policies_tenant_idx").on(t.tenantId),
    uniqueIndex("approval_policies_tenant_code_version_unique").on(t.tenantId, t.code, t.version),
    check("approval_policies_status_check", sql`${t.status} IN ('draft','published','archived')`),
    check("approval_policies_version_check", sql`${t.version} >= 1`),
    check(
      "approval_policies_effective_check",
      sql`${t.effectiveTo} IS NULL OR ${t.effectiveFrom} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`,
    ),
  ],
);

export const approvalPolicySteps = pgTable(
  "approval_policy_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => approvalPolicies.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    role: text("role").notNull(),
    name: text("name"),
    required: boolean("required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("approval_policy_steps_policy_sequence_unique").on(t.policyId, t.sequence),
    index("approval_policy_steps_tenant_idx").on(t.tenantId),
    index("approval_policy_steps_policy_idx").on(t.policyId),
    check("approval_policy_steps_sequence_check", sql`${t.sequence} >= 1`),
    check(
      "approval_policy_steps_role_check",
      sql`${t.role} IN ('manager','finance','admin','ops')`,
    ),
  ],
);
