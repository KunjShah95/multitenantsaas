-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable and force RLS on every tenant-owned table + create isolation policies
-- Using FORCE ensures even table owner is constrained; runtime role must not BYPASSRLS

-- teams
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_tenant_isolation" ON "teams";
CREATE POLICY "teams_tenant_isolation" ON "teams"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- memberships
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships_tenant_isolation" ON "memberships";
CREATE POLICY "memberships_tenant_isolation" ON "memberships"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- sessions
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_tenant_isolation" ON "sessions";
CREATE POLICY "sessions_tenant_isolation" ON "sessions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- invitations
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_tenant_isolation" ON "invitations";
CREATE POLICY "invitations_tenant_isolation" ON "invitations"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- customers
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_tenant_isolation" ON "customers";
CREATE POLICY "customers_tenant_isolation" ON "customers"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- customer_contacts
ALTER TABLE "customer_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_contacts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_contacts_tenant_isolation" ON "customer_contacts";
CREATE POLICY "customer_contacts_tenant_isolation" ON "customer_contacts"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- audit_events
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_events_tenant_isolation" ON "audit_events";
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- outbox_events
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outbox_events_tenant_isolation" ON "outbox_events";
CREATE POLICY "outbox_events_tenant_isolation" ON "outbox_events"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- idempotency_keys
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "idempotency_keys_tenant_isolation" ON "idempotency_keys";
CREATE POLICY "idempotency_keys_tenant_isolation" ON "idempotency_keys"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
