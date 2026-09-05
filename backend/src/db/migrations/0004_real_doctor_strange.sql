CREATE TABLE "approval_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" varchar(64),
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "approval_policies_status_check" CHECK ("approval_policies"."status" IN ('draft','published','archived')),
	CONSTRAINT "approval_policies_version_check" CHECK ("approval_policies"."version" >= 1),
	CONSTRAINT "approval_policies_effective_check" CHECK ("approval_policies"."effective_to" IS NULL OR "approval_policies"."effective_from" IS NULL OR "approval_policies"."effective_to" > "approval_policies"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "approval_policy_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"role" text NOT NULL,
	"name" text,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_policy_steps_sequence_check" CHECK ("approval_policy_steps"."sequence" >= 1),
	CONSTRAINT "approval_policy_steps_role_check" CHECK ("approval_policy_steps"."role" IN ('manager','finance','admin','ops'))
);
--> statement-breakpoint
CREATE TABLE "customer_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "customer_tiers_code_check" CHECK (char_length("customer_tiers"."code") > 0),
	CONSTRAINT "customer_tiers_name_check" CHECK (char_length("customer_tiers"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "discount_category_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"ceiling_pct" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" varchar(64),
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "discount_policies_status_check" CHECK ("discount_policies"."status" IN ('draft','published','archived')),
	CONSTRAINT "discount_policies_version_check" CHECK ("discount_policies"."version" >= 1),
	CONSTRAINT "discount_policies_effective_check" CHECK ("discount_policies"."effective_to" IS NULL OR "discount_policies"."effective_from" IS NULL OR "discount_policies"."effective_to" > "discount_policies"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "discount_tier_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"tier_code" varchar(64) NOT NULL,
	"ceiling_pct" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "product_categories_code_check" CHECK (char_length("product_categories"."code") > 0),
	CONSTRAINT "product_categories_name_check" CHECK (char_length("product_categories"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"unit" varchar(32) DEFAULT 'ea' NOT NULL,
	"standard_price" numeric(20, 6) NOT NULL,
	"standard_cost" numeric(20, 6) DEFAULT '0' NOT NULL,
	"tax_rate_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "products_sku_check" CHECK (char_length("products"."sku") > 0),
	CONSTRAINT "products_name_check" CHECK (char_length("products"."name") > 0),
	CONSTRAINT "products_price_check" CHECK ("products"."standard_price" >= 0),
	CONSTRAINT "products_cost_check" CHECK ("products"."standard_cost" >= 0),
	CONSTRAINT "products_tax_check" CHECK ("products"."tax_rate_pct" >= 0 AND "products"."tax_rate_pct" <= 100)
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(64),
	"attribute" text NOT NULL,
	"value" text NOT NULL,
	"extra_price" numeric(20, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "product_variants_attr_check" CHECK (char_length("product_variants"."attribute") > 0),
	CONSTRAINT "product_variants_value_check" CHECK (char_length("product_variants"."value") > 0)
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"currency" varchar(3) NOT NULL,
	"customer_tier_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "price_lists_name_check" CHECK (char_length("price_lists"."name") > 0),
	CONSTRAINT "price_lists_currency_check" CHECK (char_length("price_lists"."currency") = 3),
	CONSTRAINT "price_lists_status_check" CHECK ("price_lists"."status" IN ('active','archived')),
	CONSTRAINT "price_lists_effective_check" CHECK ("price_lists"."effective_to" IS NULL OR "price_lists"."effective_from" IS NULL OR "price_lists"."effective_to" > "price_lists"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "price_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"price" numeric(20, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_list_items_price_check" CHECK ("price_list_items"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"shipping_cost_weight" numeric(10, 4) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "warehouses_code_check" CHECK (char_length("warehouses"."code") > 0),
	CONSTRAINT "warehouses_name_check" CHECK (char_length("warehouses"."name") > 0),
	CONSTRAINT "warehouses_weight_check" CHECK ("warehouses"."shipping_cost_weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"on_hand_qty" numeric(20, 6) DEFAULT '0' NOT NULL,
	"reserved_qty" numeric(20, 6) DEFAULT '0' NOT NULL,
	"allocated_qty" numeric(20, 6) DEFAULT '0' NOT NULL,
	"reorder_point" numeric(20, 6),
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_balances_sku_check" CHECK (char_length("inventory_balances"."sku") > 0),
	CONSTRAINT "inventory_balances_onhand_check" CHECK ("inventory_balances"."on_hand_qty" >= 0),
	CONSTRAINT "inventory_balances_reserved_check" CHECK ("inventory_balances"."reserved_qty" >= 0),
	CONSTRAINT "inventory_balances_allocated_check" CHECK ("inventory_balances"."allocated_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"delta_qty" numeric(20, 6) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"billing_interval" varchar(32) DEFAULT 'monthly' NOT NULL,
	"price" numeric(20, 6) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "subscription_plans_code_check" CHECK (char_length("subscription_plans"."code") > 0),
	CONSTRAINT "subscription_plans_name_check" CHECK (char_length("subscription_plans"."name") > 0),
	CONSTRAINT "subscription_plans_interval_check" CHECK ("subscription_plans"."billing_interval" IN ('monthly','quarterly','yearly')),
	CONSTRAINT "subscription_plans_price_check" CHECK ("subscription_plans"."price" >= 0),
	CONSTRAINT "subscription_plans_currency_check" CHECK (char_length("subscription_plans"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "upsell_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trigger_product_id" uuid NOT NULL,
	"suggested_product_id" uuid NOT NULL,
	"weight" numeric(10, 4) DEFAULT '1' NOT NULL,
	"promoted" boolean DEFAULT false NOT NULL,
	"min_margin_pct" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "tier_code" varchar(64);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policy_steps" ADD CONSTRAINT "approval_policy_steps_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policy_steps" ADD CONSTRAINT "approval_policy_steps_policy_id_approval_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."approval_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tiers" ADD CONSTRAINT "customer_tiers_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_category_limits" ADD CONSTRAINT "discount_category_limits_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_category_limits" ADD CONSTRAINT "discount_category_limits_policy_id_discount_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."discount_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_policies" ADD CONSTRAINT "discount_policies_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_tier_limits" ADD CONSTRAINT "discount_tier_limits_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_tier_limits" ADD CONSTRAINT "discount_tier_limits_policy_id_discount_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."discount_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_customer_tier_id_customer_tiers_id_fk" FOREIGN KEY ("customer_tier_id") REFERENCES "public"."customer_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upsell_rules" ADD CONSTRAINT "upsell_rules_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upsell_rules" ADD CONSTRAINT "upsell_rules_trigger_product_id_products_id_fk" FOREIGN KEY ("trigger_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upsell_rules" ADD CONSTRAINT "upsell_rules_suggested_product_id_products_id_fk" FOREIGN KEY ("suggested_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_policies_tenant_idx" ON "approval_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_policies_tenant_code_version_unique" ON "approval_policies" USING btree ("tenant_id","code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_policy_steps_policy_sequence_unique" ON "approval_policy_steps" USING btree ("policy_id","sequence");--> statement-breakpoint
CREATE INDEX "approval_policy_steps_tenant_idx" ON "approval_policy_steps" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "approval_policy_steps_policy_idx" ON "approval_policy_steps" USING btree ("policy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_tiers_tenant_code_unique" ON "customer_tiers" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "customer_tiers_tenant_idx" ON "customer_tiers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_category_limits_policy_category_unique" ON "discount_category_limits" USING btree ("policy_id","category_code");--> statement-breakpoint
CREATE INDEX "discount_category_limits_tenant_idx" ON "discount_category_limits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "discount_category_limits_policy_idx" ON "discount_category_limits" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "discount_policies_tenant_idx" ON "discount_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_policies_tenant_code_version_unique" ON "discount_policies" USING btree ("tenant_id","code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_tier_limits_policy_tier_unique" ON "discount_tier_limits" USING btree ("policy_id","tier_code");--> statement-breakpoint
CREATE INDEX "discount_tier_limits_tenant_idx" ON "discount_tier_limits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "discount_tier_limits_policy_idx" ON "discount_tier_limits" USING btree ("policy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_tenant_code_unique" ON "product_categories" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "product_categories_tenant_idx" ON "product_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_sku_unique" ON "products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "products_tenant_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_variants_tenant_idx" ON "product_variants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_tenant_sku_unique" ON "product_variants" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "price_lists_tenant_idx" ON "price_lists" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "price_lists_tenant_currency_idx" ON "price_lists" USING btree ("tenant_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_items_list_product_variant_unique" ON "price_list_items" USING btree ("price_list_id","product_id","variant_id");--> statement-breakpoint
CREATE INDEX "price_list_items_tenant_idx" ON "price_list_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "price_list_items_list_idx" ON "price_list_items" USING btree ("price_list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_tenant_code_unique" ON "warehouses" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "warehouses_tenant_idx" ON "warehouses" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_balances_tenant_warehouse_sku_unique" ON "inventory_balances" USING btree ("tenant_id","warehouse_id","sku");--> statement-breakpoint
CREATE INDEX "inventory_balances_tenant_idx" ON "inventory_balances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_balances_warehouse_idx" ON "inventory_balances" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_tenant_idx" ON "inventory_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_warehouse_sku_idx" ON "inventory_movements" USING btree ("warehouse_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_tenant_code_unique" ON "subscription_plans" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "subscription_plans_tenant_idx" ON "subscription_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upsell_rules_tenant_trigger_suggested_unique" ON "upsell_rules" USING btree ("tenant_id","trigger_product_id","suggested_product_id");--> statement-breakpoint
CREATE INDEX "upsell_rules_tenant_idx" ON "upsell_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "upsell_rules_trigger_idx" ON "upsell_rules" USING btree ("trigger_product_id");