-- Fix RLS policies to handle missing tenant_id gracefully (null vs empty string)
-- Previously policies used current_setting('app.tenant_id', true)::uuid which throws on empty string
-- Use nullif to convert '' to null, preventing 22P02 error and correctly filtering to 0 rows

DROP POLICY IF EXISTS "teams_tenant_isolation" ON "teams";
CREATE POLICY "teams_tenant_isolation" ON "teams"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "memberships_tenant_isolation" ON "memberships";
CREATE POLICY "memberships_tenant_isolation" ON "memberships"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "sessions_tenant_isolation" ON "sessions";
CREATE POLICY "sessions_tenant_isolation" ON "sessions"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "invitations_tenant_isolation" ON "invitations";
CREATE POLICY "invitations_tenant_isolation" ON "invitations"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "customers_tenant_isolation" ON "customers";
CREATE POLICY "customers_tenant_isolation" ON "customers"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "customer_contacts_tenant_isolation" ON "customer_contacts";
CREATE POLICY "customer_contacts_tenant_isolation" ON "customer_contacts"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "audit_events_tenant_isolation" ON "audit_events";
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "outbox_events_tenant_isolation" ON "outbox_events";
CREATE POLICY "outbox_events_tenant_isolation" ON "outbox_events"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "idempotency_keys_tenant_isolation" ON "idempotency_keys";
CREATE POLICY "idempotency_keys_tenant_isolation" ON "idempotency_keys"
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
