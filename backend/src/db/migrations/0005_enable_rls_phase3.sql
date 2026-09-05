-- Enable and force RLS on Phase 3 catalog/governance tables
-- Uses nullif handling for missing tenant_id (same as 0002 fix)

-- customer_tiers
ALTER TABLE "customer_tiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_tiers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_tiers_tenant_isolation" ON "customer_tiers";
CREATE POLICY "customer_tiers_tenant_isolation" ON "customer_tiers"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- product_categories
ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_categories" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_categories_tenant_isolation" ON "product_categories";
CREATE POLICY "product_categories_tenant_isolation" ON "product_categories"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- products
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_tenant_isolation" ON "products";
CREATE POLICY "products_tenant_isolation" ON "products"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- product_variants
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_variants_tenant_isolation" ON "product_variants";
CREATE POLICY "product_variants_tenant_isolation" ON "product_variants"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- price_lists
ALTER TABLE "price_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_lists" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_lists_tenant_isolation" ON "price_lists";
CREATE POLICY "price_lists_tenant_isolation" ON "price_lists"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- price_list_items
ALTER TABLE "price_list_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_list_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_list_items_tenant_isolation" ON "price_list_items";
CREATE POLICY "price_list_items_tenant_isolation" ON "price_list_items"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- discount_policies
ALTER TABLE "discount_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_policies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discount_policies_tenant_isolation" ON "discount_policies";
CREATE POLICY "discount_policies_tenant_isolation" ON "discount_policies"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- discount_tier_limits
ALTER TABLE "discount_tier_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_tier_limits" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discount_tier_limits_tenant_isolation" ON "discount_tier_limits";
CREATE POLICY "discount_tier_limits_tenant_isolation" ON "discount_tier_limits"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- discount_category_limits
ALTER TABLE "discount_category_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_category_limits" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discount_category_limits_tenant_isolation" ON "discount_category_limits";
CREATE POLICY "discount_category_limits_tenant_isolation" ON "discount_category_limits"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- approval_policies
ALTER TABLE "approval_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_policies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_policies_tenant_isolation" ON "approval_policies";
CREATE POLICY "approval_policies_tenant_isolation" ON "approval_policies"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- approval_policy_steps
ALTER TABLE "approval_policy_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_policy_steps" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_policy_steps_tenant_isolation" ON "approval_policy_steps";
CREATE POLICY "approval_policy_steps_tenant_isolation" ON "approval_policy_steps"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- warehouses
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouses_tenant_isolation" ON "warehouses";
CREATE POLICY "warehouses_tenant_isolation" ON "warehouses"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- inventory_balances
ALTER TABLE "inventory_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_balances" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_balances_tenant_isolation" ON "inventory_balances";
CREATE POLICY "inventory_balances_tenant_isolation" ON "inventory_balances"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- inventory_movements
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_movements_tenant_isolation" ON "inventory_movements";
CREATE POLICY "inventory_movements_tenant_isolation" ON "inventory_movements"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- subscription_plans
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_plans" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscription_plans_tenant_isolation" ON "subscription_plans";
CREATE POLICY "subscription_plans_tenant_isolation" ON "subscription_plans"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- upsell_rules
ALTER TABLE "upsell_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "upsell_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "upsell_rules_tenant_isolation" ON "upsell_rules";
CREATE POLICY "upsell_rules_tenant_isolation" ON "upsell_rules"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
