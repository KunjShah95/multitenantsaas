CREATE TABLE "fulfillment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fulfillment_plan_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"requested_qty" numeric(20, 6) NOT NULL,
	"allocated_qty" numeric(20, 6) DEFAULT '0' NOT NULL,
	"backordered_qty" numeric(20, 6) DEFAULT '0' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillment_allocations_sku_check" CHECK (char_length("fulfillment_allocations"."sku") > 0),
	CONSTRAINT "fulfillment_allocations_requested_check" CHECK ("fulfillment_allocations"."requested_qty" > 0),
	CONSTRAINT "fulfillment_allocations_allocated_check" CHECK ("fulfillment_allocations"."allocated_qty" >= 0),
	CONSTRAINT "fulfillment_allocations_backordered_check" CHECK ("fulfillment_allocations"."backordered_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fulfillment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'planned' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"snapshot_time" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_cost" numeric(20, 6),
	"estimated_shipments" integer,
	"snapshot" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillment_plans_status_check" CHECK ("fulfillment_plans"."status" IN ('draft','planned','reserved','partiallyReserved','backordered','superseded','cancelled')),
	CONSTRAINT "fulfillment_plans_revision_check" CHECK ("fulfillment_plans"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" varchar(32) NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_version_id" uuid,
	"quote_version_number" integer NOT NULL,
	"customer_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(32) DEFAULT 'orderCreated' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"subtotal" numeric(20, 6) DEFAULT '0' NOT NULL,
	"discount_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"net_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"tax_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"grand_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_check" CHECK (char_length("orders"."number") > 0),
	CONSTRAINT "orders_currency_check" CHECK (char_length("orders"."currency") = 3),
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('orderCreated','allocationPlanned','stockReserved','packing','partiallyShipped','shipped','delivered','backordered','cancelled')),
	CONSTRAINT "orders_revision_check" CHECK ("orders"."revision" >= 1),
	CONSTRAINT "orders_quote_version_check" CHECK ("orders"."quote_version_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"quote_line_id" uuid,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"subscription_plan_id" uuid,
	"quantity" numeric(20, 6) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"billing_type" varchar(32) DEFAULT 'one_time' NOT NULL,
	"snapshot_name" text NOT NULL,
	"snapshot_sku" varchar(64) NOT NULL,
	"snapshot_variant_sku" varchar(64),
	"snapshot_category_id" uuid,
	"snapshot_category_code" varchar(64),
	"snapshot_unit" varchar(32) NOT NULL,
	"snapshot_unit_price" numeric(20, 6) NOT NULL,
	"snapshot_unit_cost" numeric(20, 6) DEFAULT '0' NOT NULL,
	"snapshot_tax_rate_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"snapshot_currency" varchar(3) NOT NULL,
	"line_subtotal" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_discount" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_net" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_tax" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_margin" numeric(20, 6),
	"line_margin_pct" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_lines_quantity_check" CHECK ("order_lines"."quantity" > 0),
	CONSTRAINT "order_lines_discount_check" CHECK ("order_lines"."discount_pct" >= 0 AND "order_lines"."discount_pct" <= 100),
	CONSTRAINT "order_lines_tax_check" CHECK ("order_lines"."snapshot_tax_rate_pct" >= 0 AND "order_lines"."snapshot_tax_rate_pct" <= 100),
	CONSTRAINT "order_lines_billing_check" CHECK ("order_lines"."billing_type" IN ('one_time','recurring'))
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"order_id" uuid NOT NULL,
	"order_line_id" uuid,
	"fulfillment_allocation_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_reservations_sku_check" CHECK (char_length("inventory_reservations"."sku") > 0),
	CONSTRAINT "inventory_reservations_quantity_check" CHECK ("inventory_reservations"."quantity" > 0),
	CONSTRAINT "inventory_reservations_status_check" CHECK ("inventory_reservations"."status" IN ('active','shipped','released','expired'))
);
--> statement-breakpoint
CREATE TABLE "shipment_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"reservation_id" uuid,
	"sku" text NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_lines_sku_check" CHECK (char_length("shipment_lines"."sku") > 0),
	CONSTRAINT "shipment_lines_quantity_check" CHECK ("shipment_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"number" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'created' NOT NULL,
	"carrier" varchar(64),
	"tracking_number" varchar(128),
	"estimated_delivery_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_number_check" CHECK (char_length("shipments"."number") > 0),
	CONSTRAINT "shipments_status_check" CHECK ("shipments"."status" IN ('created','packing','shipped','delivered','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_fulfillment_plan_id_fulfillment_plans_id_fk" FOREIGN KEY ("fulfillment_plan_id") REFERENCES "public"."fulfillment_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_plans" ADD CONSTRAINT "fulfillment_plans_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_plans" ADD CONSTRAINT "fulfillment_plans_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_plans" ADD CONSTRAINT "fulfillment_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quote_line_id_quote_lines_id_fk" FOREIGN KEY ("quote_line_id") REFERENCES "public"."quote_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_fulfillment_allocation_id_fulfillment_allocations_id_fk" FOREIGN KEY ("fulfillment_allocation_id") REFERENCES "public"."fulfillment_allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_reservation_id_inventory_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."inventory_reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fulfillment_allocations_tenant_idx" ON "fulfillment_allocations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fulfillment_allocations_plan_idx" ON "fulfillment_allocations" USING btree ("fulfillment_plan_id");--> statement-breakpoint
CREATE INDEX "fulfillment_allocations_order_line_idx" ON "fulfillment_allocations" USING btree ("order_line_id");--> statement-breakpoint
CREATE INDEX "fulfillment_allocations_warehouse_idx" ON "fulfillment_allocations" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "fulfillment_allocations_product_idx" ON "fulfillment_allocations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "fulfillment_plans_tenant_idx" ON "fulfillment_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fulfillment_plans_order_idx" ON "fulfillment_plans" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "fulfillment_plans_tenant_order_idx" ON "fulfillment_plans" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_number_unique" ON "orders" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_quote_version_unique" ON "orders" USING btree ("tenant_id","quote_id","quote_version_number");--> statement-breakpoint
CREATE INDEX "orders_tenant_idx" ON "orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_updated_idx" ON "orders" USING btree ("tenant_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "orders_tenant_customer_idx" ON "orders" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "orders_quote_idx" ON "orders" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "order_lines_tenant_idx" ON "order_lines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "order_lines_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_lines_product_idx" ON "order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_tenant_idx" ON "inventory_reservations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_warehouse_sku_idx" ON "inventory_reservations" USING btree ("warehouse_id","sku");--> statement-breakpoint
CREATE INDEX "inventory_reservations_order_idx" ON "inventory_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_order_line_idx" ON "inventory_reservations" USING btree ("order_line_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_allocation_idx" ON "inventory_reservations" USING btree ("fulfillment_allocation_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_status_idx" ON "inventory_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_reservations_expires_idx" ON "inventory_reservations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "shipment_lines_tenant_idx" ON "shipment_lines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "shipment_lines_shipment_idx" ON "shipment_lines" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_lines_order_line_idx" ON "shipment_lines" USING btree ("order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_tenant_number_unique" ON "shipments" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "shipments_tenant_idx" ON "shipments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipments_warehouse_idx" ON "shipments" USING btree ("warehouse_id");--> statement-breakpoint
-- RLS for Phase 07 tables (tenant isolation)
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_tenant_isolation" ON "orders";
CREATE POLICY "orders_tenant_isolation" ON "orders"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_lines_tenant_isolation" ON "order_lines";
CREATE POLICY "order_lines_tenant_isolation" ON "order_lines"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "fulfillment_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fulfillment_plans" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fulfillment_plans_tenant_isolation" ON "fulfillment_plans";
CREATE POLICY "fulfillment_plans_tenant_isolation" ON "fulfillment_plans"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fulfillment_allocations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fulfillment_allocations_tenant_isolation" ON "fulfillment_allocations";
CREATE POLICY "fulfillment_allocations_tenant_isolation" ON "fulfillment_allocations"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "inventory_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_reservations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_reservations_tenant_isolation" ON "inventory_reservations";
CREATE POLICY "inventory_reservations_tenant_isolation" ON "inventory_reservations"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipments_tenant_isolation" ON "shipments";
CREATE POLICY "shipments_tenant_isolation" ON "shipments"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "shipment_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipment_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipment_lines_tenant_isolation" ON "shipment_lines";
CREATE POLICY "shipment_lines_tenant_isolation" ON "shipment_lines"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);