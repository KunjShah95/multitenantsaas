-- Phase 8 billing: partial unique index + RLS

CREATE UNIQUE INDEX "invoices_tenant_order_one_time_unique"
  ON "invoices" ("tenant_id", "order_id")
  WHERE "invoice_type" = 'one_time' AND "order_id" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_tenant_isolation" ON "subscriptions";
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE "subscription_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_changes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscription_changes_tenant_isolation" ON "subscription_changes";
CREATE POLICY "subscription_changes_tenant_isolation" ON "subscription_changes"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_tenant_isolation" ON "invoices";
CREATE POLICY "invoices_tenant_isolation" ON "invoices"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_lines_tenant_isolation" ON "invoice_lines";
CREATE POLICY "invoice_lines_tenant_isolation" ON "invoice_lines"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE "adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "adjustments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adjustments_tenant_isolation" ON "adjustments";
CREATE POLICY "adjustments_tenant_isolation" ON "adjustments"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_tenant_isolation" ON "payments";
CREATE POLICY "payments_tenant_isolation" ON "payments"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE "billing_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_jobs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_jobs_tenant_isolation" ON "billing_jobs";
CREATE POLICY "billing_jobs_tenant_isolation" ON "billing_jobs"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE "provider_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "provider_events_tenant_isolation" ON "provider_events";
CREATE POLICY "provider_events_tenant_isolation" ON "provider_events"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
