CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" varchar(32) NOT NULL,
	"customer_id" uuid NOT NULL,
	"owner_membership_id" uuid,
	"owner_user_id" uuid,
	"team_id" uuid,
	"currency" varchar(3) NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"subtotal" numeric(20, 6) DEFAULT '0' NOT NULL,
	"discount_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"net_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"tax_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"grand_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"margin_total" numeric(20, 6),
	"margin_pct" numeric(5, 2),
	"risk_score" numeric(20, 6),
	"risk_level" varchar(32),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "quotes_number_check" CHECK (char_length("quotes"."number") > 0),
	CONSTRAINT "quotes_currency_check" CHECK (char_length("quotes"."currency") = 3),
	CONSTRAINT "quotes_status_check" CHECK ("quotes"."status" IN ('draft','submittedForApproval','awaitingApproval','approvedInternal','sharedWithCustomer','underNegotiation','customerAccepted','readyForOrder','converted','cancelled','expired','rejected','returnedForRevision')),
	CONSTRAINT "quotes_revision_check" CHECK ("quotes"."revision" >= 1),
	CONSTRAINT "quotes_subtotal_check" CHECK ("quotes"."subtotal" >= 0),
	CONSTRAINT "quotes_discount_check" CHECK ("quotes"."discount_total" >= 0),
	CONSTRAINT "quotes_net_check" CHECK ("quotes"."net_total" >= 0),
	CONSTRAINT "quotes_tax_check" CHECK ("quotes"."tax_total" >= 0),
	CONSTRAINT "quotes_grand_check" CHECK ("quotes"."grand_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
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
	CONSTRAINT "quote_lines_quantity_check" CHECK ("quote_lines"."quantity" > 0),
	CONSTRAINT "quote_lines_discount_check" CHECK ("quote_lines"."discount_pct" >= 0 AND "quote_lines"."discount_pct" <= 100),
	CONSTRAINT "quote_lines_tax_check" CHECK ("quote_lines"."snapshot_tax_rate_pct" >= 0 AND "quote_lines"."snapshot_tax_rate_pct" <= 100),
	CONSTRAINT "quote_lines_unitprice_check" CHECK ("quote_lines"."snapshot_unit_price" >= 0),
	CONSTRAINT "quote_lines_unitcost_check" CHECK ("quote_lines"."snapshot_unit_cost" >= 0),
	CONSTRAINT "quote_lines_billing_check" CHECK ("quote_lines"."billing_type" IN ('one_time','recurring')),
	CONSTRAINT "quote_lines_line_subtotal_check" CHECK ("quote_lines"."line_subtotal" >= 0),
	CONSTRAINT "quote_lines_line_net_check" CHECK ("quote_lines"."line_net" >= 0),
	CONSTRAINT "quote_lines_line_tax_check" CHECK ("quote_lines"."line_tax" >= 0),
	CONSTRAINT "quote_lines_line_total_check" CHECK ("quote_lines"."line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_versions_version_check" CHECK ("quote_versions"."version_number" >= 1),
	CONSTRAINT "quote_versions_revision_check" CHECK ("quote_versions"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_membership_id_memberships_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_tenant_number_unique" ON "quotes" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "quotes_tenant_idx" ON "quotes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quotes_tenant_status_updated_idx" ON "quotes" USING btree ("tenant_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "quotes_tenant_owner_idx" ON "quotes" USING btree ("tenant_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "quotes_tenant_team_idx" ON "quotes" USING btree ("tenant_id","team_id");--> statement-breakpoint
CREATE INDEX "quotes_tenant_customer_idx" ON "quotes" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "quote_lines_tenant_idx" ON "quote_lines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quote_lines_quote_idx" ON "quote_lines" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_lines_product_idx" ON "quote_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_versions_quote_version_unique" ON "quote_versions" USING btree ("quote_id","version_number");--> statement-breakpoint
CREATE INDEX "quote_versions_tenant_idx" ON "quote_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quote_versions_quote_idx" ON "quote_versions" USING btree ("quote_id");--> statement-breakpoint
-- RLS for Phase 4 quotes domain
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quotes_tenant_isolation" ON "quotes";
CREATE POLICY "quotes_tenant_isolation" ON "quotes"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "quote_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_lines_tenant_isolation" ON "quote_lines";
CREATE POLICY "quote_lines_tenant_isolation" ON "quote_lines"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "quote_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_versions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_versions_tenant_isolation" ON "quote_versions";
CREATE POLICY "quote_versions_tenant_isolation" ON "quote_versions"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);