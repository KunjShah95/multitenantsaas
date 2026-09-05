-- Phase 06 fix: portal_sessions and portal_magic_links must be readable by token without tenant context
-- Token lookup needs to happen before tenant is known, so RLS tenant isolation breaks portal auth.
-- Disable RLS for these tables; tenant isolation is enforced application-side via token+share checks.
ALTER TABLE "portal_sessions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_sessions" NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_sessions_tenant_isolation" ON "portal_sessions";
--> statement-breakpoint
ALTER TABLE "portal_magic_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_magic_links" NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_magic_links_tenant_isolation" ON "portal_magic_links";
