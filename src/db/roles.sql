-- DealFlow360 — Postgres roles for Neon (Phase 01)
-- Run once via Neon SQL editor or psql using the owner connection (DATABASE_URL_UNPOOLED).
-- Keep credentials outside Git; only SQL template is tracked.

-- 1) Migration role (owns schema, runs DDL, bypasses RLS intentionally)
--    In Neon, the project owner (neondb_owner) already acts as migrator.
--    If a dedicated migrator is desired, create it like:

-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_migrator') THEN
--     CREATE ROLE app_migrator WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_RANDOM';
--   END IF;
-- END $$;
-- GRANT ALL ON SCHEMA public TO app_migrator;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_migrator;

-- 2) Runtime role (application API) — must NOT bypass RLS, must NOT own tables
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
--     CREATE ROLE app_runtime WITH LOGIN PASSWORD 'CHANGE_ME_DIFFERENT_RANDOM' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
--   END IF;
-- END $$;

-- -- Grant minimal privileges needed for phase 01 tables
-- GRANT USAGE ON SCHEMA public TO app_runtime;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- -- Revoke ability to change RLS/bypass
-- -- app_runtime remains NOBYPASSRLS; migration role owns tables so RLS FORCE constrains even owner in tests

-- Verification queries (run as owner):
-- SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('app_migrator','app_runtime','neondb_owner');
-- SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('teams','memberships','sessions','invitations','customers','customer_contacts','audit_events','outbox_events','idempotency_keys');

-- Notes:
-- - Phase 01 uses FORCE RLS so even neondb_owner is constrained when app.tenant_id differs — this enables CI to test tenant isolation without a second connection string.
-- - In production, DATABASE_URL must use app_runtime (pooled), DATABASE_URL_UNPOOLED must use app_migrator/owner (direct).
-- - Do not grant app_runtime ownership or SUPERUSER; never turn off RLS to make tests easier.
