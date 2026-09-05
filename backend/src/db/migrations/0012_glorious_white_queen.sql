CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"adjustment_type" varchar(32) NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"reason" text,
	"reference" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adjustments_type_check" CHECK ("adjustments"."adjustment_type" IN ('debit','credit','refund')),
	CONSTRAINT "adjustments_amount_check" CHECK ("adjustments"."amount" > 0),
	CONSTRAINT "adjustments_currency_check" CHECK (char_length("adjustments"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "billing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"job_type" varchar(32) DEFAULT 'recurring_invoice' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_jobs_type_check" CHECK ("billing_jobs"."job_type" IN ('recurring_invoice')),
	CONSTRAINT "billing_jobs_status_check" CHECK ("billing_jobs"."status" IN ('pending','processing','completed','failed')),
	CONSTRAINT "billing_jobs_attempts_check" CHECK ("billing_jobs"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_plan_id" uuid,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"billing_interval" varchar(32) NOT NULL,
	"billing_anchor_date" date NOT NULL,
	"billing_timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"snapshot_plan_code" varchar(64),
	"snapshot_plan_name" text,
	"snapshot_name" text NOT NULL,
	"snapshot_sku" varchar(64) NOT NULL,
	"snapshot_unit" varchar(32) NOT NULL,
	"snapshot_unit_price" numeric(20, 6) NOT NULL,
	"snapshot_tax_rate_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"snapshot_currency" varchar(3) NOT NULL,
	"period_unit_net" numeric(20, 6) NOT NULL,
	"period_unit_tax" numeric(20, 6) NOT NULL,
	"period_unit_total" numeric(20, 6) NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"next_bill_at" timestamp with time zone NOT NULL,
	"cancel_policy" varchar(32) DEFAULT 'credit_remaining' NOT NULL,
	"cancel_effective_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('active','cancelled','pending')),
	CONSTRAINT "subscriptions_interval_check" CHECK ("subscriptions"."billing_interval" IN ('monthly','quarterly','yearly')),
	CONSTRAINT "subscriptions_cancel_policy_check" CHECK ("subscriptions"."cancel_policy" IN ('credit_remaining','no_refund','charge_remaining')),
	CONSTRAINT "subscriptions_quantity_check" CHECK ("subscriptions"."quantity" > 0),
	CONSTRAINT "subscriptions_discount_check" CHECK ("subscriptions"."discount_pct" >= 0 AND "subscriptions"."discount_pct" <= 100),
	CONSTRAINT "subscriptions_revision_check" CHECK ("subscriptions"."revision" >= 1),
	CONSTRAINT "subscriptions_period_end_check" CHECK ("subscriptions"."current_period_end" > "subscriptions"."current_period_start")
);
--> statement-breakpoint
CREATE TABLE "subscription_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"change_type" varchar(32) NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"previous_snapshot" text NOT NULL,
	"new_snapshot" text NOT NULL,
	"proration_net" numeric(20, 6) DEFAULT '0' NOT NULL,
	"proration_tax" numeric(20, 6) DEFAULT '0' NOT NULL,
	"proration_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"adjustment_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_changes_type_check" CHECK ("subscription_changes"."change_type" IN ('quantity','plan','discount','cancel'))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" varchar(32) NOT NULL,
	"order_id" uuid,
	"subscription_id" uuid,
	"customer_id" uuid NOT NULL,
	"invoice_type" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"subtotal" numeric(20, 6) DEFAULT '0' NOT NULL,
	"discount_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"net_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"tax_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"grand_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"balance" numeric(20, 6) DEFAULT '0' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_check" CHECK (char_length("invoices"."number") > 0),
	CONSTRAINT "invoices_currency_check" CHECK (char_length("invoices"."currency") = 3),
	CONSTRAINT "invoices_type_check" CHECK ("invoices"."invoice_type" IN ('one_time','recurring','adjustment')),
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" IN ('draft','issued','partial','paid','void','overdue')),
	CONSTRAINT "invoices_revision_check" CHECK ("invoices"."revision" >= 1),
	CONSTRAINT "invoices_balance_check" CHECK ("invoices"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"order_line_id" uuid,
	"line_number" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"unit_price" numeric(20, 6) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_rate_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"line_subtotal" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_discount" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_net" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_tax" numeric(20, 6) DEFAULT '0' NOT NULL,
	"line_total" numeric(20, 6) DEFAULT '0' NOT NULL,
	"immutable" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_lines_quantity_check" CHECK ("invoice_lines"."quantity" > 0),
	CONSTRAINT "invoice_lines_discount_check" CHECK ("invoice_lines"."discount_pct" >= 0 AND "invoice_lines"."discount_pct" <= 100),
	CONSTRAINT "invoice_lines_immutable_check" CHECK ("invoice_lines"."immutable" IN (0,1)),
	CONSTRAINT "invoice_lines_line_number_check" CHECK ("invoice_lines"."line_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"method" varchar(32) DEFAULT 'manual' NOT NULL,
	"reference" varchar(128),
	"paid_at" timestamp with time zone NOT NULL,
	"recorded_by" uuid,
	"provider_external_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_currency_check" CHECK (char_length("payments"."currency") = 3),
	CONSTRAINT "payments_method_check" CHECK ("payments"."method" IN ('manual','provider'))
);
--> statement-breakpoint
CREATE TABLE "provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"external_event_id" varchar(128) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_events_provider_check" CHECK (char_length("provider_events"."provider") > 0),
	CONSTRAINT "provider_events_external_check" CHECK (char_length("provider_events"."external_event_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_jobs" ADD CONSTRAINT "billing_jobs_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_jobs" ADD CONSTRAINT "billing_jobs_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_adjustment_id_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."adjustments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adjustments_tenant_idx" ON "adjustments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "adjustments_subscription_idx" ON "adjustments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "adjustments_invoice_idx" ON "adjustments" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_jobs_tenant_idempotency_unique" ON "billing_jobs" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "billing_jobs_tenant_status_due_idx" ON "billing_jobs" USING btree ("tenant_id","status","due_at");--> statement-breakpoint
CREATE INDEX "billing_jobs_subscription_idx" ON "billing_jobs" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_tenant_order_line_unique" ON "subscriptions" USING btree ("tenant_id","order_line_id");--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_idx" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_customer_idx" ON "subscriptions" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_status_next_bill_idx" ON "subscriptions" USING btree ("tenant_id","status","next_bill_at");--> statement-breakpoint
CREATE INDEX "subscriptions_order_idx" ON "subscriptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "subscription_changes_tenant_idx" ON "subscription_changes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "subscription_changes_subscription_idx" ON "subscription_changes" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_tenant_number_unique" ON "invoices" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "invoices_tenant_idx" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoices_tenant_status_due_idx" ON "invoices" USING btree ("tenant_id","status","due_at");--> statement-breakpoint
CREATE INDEX "invoices_tenant_customer_idx" ON "invoices" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "invoices_order_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_tenant_idx" ON "invoice_lines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_idx" ON "payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_tenant_provider_external_unique" ON "payments" USING btree ("tenant_id","provider_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_events_tenant_provider_external_unique" ON "provider_events" USING btree ("tenant_id","provider","external_event_id");--> statement-breakpoint
CREATE INDEX "provider_events_tenant_idx" ON "provider_events" USING btree ("tenant_id");