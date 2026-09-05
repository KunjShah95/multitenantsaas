CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"alert_type" varchar(64) NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"severity" varchar(32) DEFAULT 'warning' NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"confidence" numeric(5, 2),
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_time" timestamp with time zone DEFAULT now() NOT NULL,
	"fingerprint" varchar(128) NOT NULL,
	"nudged_at" timestamp with time zone,
	"nudge_count" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alerts_type_check" CHECK ("alerts"."alert_type" IN ('stalled_quote','discount_anomaly','delivery_slippage','overdue_invoice')),
	CONSTRAINT "alerts_status_check" CHECK ("alerts"."status" IN ('active','dismissed','resolved')),
	CONSTRAINT "alerts_severity_check" CHECK ("alerts"."severity" IN ('info','warning','critical')),
	CONSTRAINT "alerts_nudge_count_check" CHECK ("alerts"."nudge_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"recipient_role" varchar(32),
	"alert_id" uuid,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"delivery_channel" varchar(32) DEFAULT 'in_app' NOT NULL,
	"delivery_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_channel_check" CHECK ("notifications"."delivery_channel" IN ('in_app','email','webhook')),
	CONSTRAINT "notifications_status_check" CHECK ("notifications"."delivery_status" IN ('pending','delivered','failed'))
);
--> statement-breakpoint
CREATE TABLE "report_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requested_by" uuid,
	"report_type" varchar(32) NOT NULL,
	"format" varchar(16) NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"row_count" integer,
	"file_size_bytes" integer,
	"storage_key" text,
	"download_token" varchar(128),
	"file_content" text,
	"expires_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_exports_type_check" CHECK ("report_exports"."report_type" IN ('quotes','orders','sales')),
	CONSTRAINT "report_exports_format_check" CHECK ("report_exports"."format" IN ('csv','json')),
	CONSTRAINT "report_exports_status_check" CHECK ("report_exports"."status" IN ('pending','processing','completed','failed'))
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "alerts_tenant_idx" ON "alerts" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "alerts_tenant_status_idx" ON "alerts" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX "alerts_tenant_fingerprint_idx" ON "alerts" USING btree ("tenant_id","fingerprint");
--> statement-breakpoint
CREATE INDEX "alerts_tenant_entity_idx" ON "alerts" USING btree ("tenant_id","entity_type","entity_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_tenant_fingerprint_active_unique" ON "alerts" ("tenant_id", "fingerprint") WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "notifications_tenant_recipient_idx" ON "notifications" USING btree ("tenant_id","recipient_user_id","read_at");
--> statement-breakpoint
CREATE INDEX "notifications_tenant_status_idx" ON "notifications" USING btree ("tenant_id","delivery_status");
--> statement-breakpoint
CREATE INDEX "report_exports_tenant_idx" ON "report_exports" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "report_exports_tenant_created_idx" ON "report_exports" USING btree ("tenant_id","created_at");
--> statement-breakpoint
CREATE INDEX "report_exports_tenant_status_idx" ON "report_exports" USING btree ("tenant_id","status");
--> statement-breakpoint
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alerts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_tenant_isolation" ON "alerts";
CREATE POLICY "alerts_tenant_isolation" ON "alerts"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_tenant_isolation" ON "notifications";
CREATE POLICY "notifications_tenant_isolation" ON "notifications"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "report_exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_exports" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "report_exports_tenant_isolation" ON "report_exports";
CREATE POLICY "report_exports_tenant_isolation" ON "report_exports"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
