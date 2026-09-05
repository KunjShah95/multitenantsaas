import { pgTable, uuid, text, timestamp, integer, varchar, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";

export const discountPolicies = pgTable(
  "discount_policies",
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
    index("discount_policies_tenant_idx").on(t.tenantId),
    uniqueIndex("discount_policies_tenant_code_version_unique").on(t.tenantId, t.code, t.version),
    check("discount_policies_status_check", sql`${t.status} IN ('draft','published','archived')`),
    check("discount_policies_version_check", sql`${t.version} >= 1`),
    check("discount_policies_effective_check", sql`${t.effectiveTo} IS NULL OR ${t.effectiveFrom} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
  ],
);

export const discountTierLimits = pgTable(
  "discount_tier_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => discountPolicies.id, { onDelete: "cascade" }),
    tierCode: varchar("tier_code", { length: 64 }).notNull(),
    ceilingPct: varchar("ceiling_pct", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("discount_tier_limits_policy_tier_unique").on(t.policyId, t.tierCode),
    index("discount_tier_limits_tenant_idx").on(t.tenantId),
    index("discount_tier_limits_policy_idx").on(t.policyId),
  ],
);

export const discountCategoryLimits = pgTable(
  "discount_category_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => discountPolicies.id, { onDelete: "cascade" }),
    categoryCode: varchar("category_code", { length: 64 }).notNull(),
    ceilingPct: varchar("ceiling_pct", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("discount_category_limits_policy_category_unique").on(t.policyId, t.categoryCode),
    index("discount_category_limits_tenant_idx").on(t.tenantId),
    index("discount_category_limits_policy_idx").on(t.policyId),
  ],
);
