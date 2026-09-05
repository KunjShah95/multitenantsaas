import { pgTable, uuid, timestamp, numeric, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { products } from "./products.js";

export const upsellRules = pgTable(
  "upsell_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    triggerProductId: uuid("trigger_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    suggestedProductId: uuid("suggested_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    weight: numeric("weight", { precision: 10, scale: 4 }).notNull().default("1"),
    promoted: boolean("promoted").notNull().default(false),
    minMarginPct: numeric("min_margin_pct", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("upsell_rules_tenant_trigger_suggested_unique").on(t.tenantId, t.triggerProductId, t.suggestedProductId),
    index("upsell_rules_tenant_idx").on(t.tenantId),
    index("upsell_rules_trigger_idx").on(t.triggerProductId),
  ],
);
