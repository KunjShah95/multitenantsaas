# Phase 01 — Neon persistence, tenant core, RLS, audit, and idempotency

**Status:** Planned  
**Depends on:** Phase 00 complete and owner Neon confirmation  
**Owner gate:** `.env` contains Neon pooled/direct URLs; no values shared

## Required reading

- [README.md](README.md)
- [../docs/02-technology-decisions.md](../docs/02-technology-decisions.md)
- [../docs/04-tenancy-auth-security.md](../docs/04-tenancy-auth-security.md)
- [../docs/05-database-design.md](../docs/05-database-design.md)
- [../docs/08-testing-operations.md](../docs/08-testing-operations.md)

## Already done

- Prototype persistence uses `Map` collections, `data.json`, and optional local
  SQLite in `utils/db.js`; it has seed users/products but no tenant model.
- No Neon connection, migration system, Drizzle schema, RLS, audit table,
  idempotency table, or real Postgres integration test exists.

## Do in this phase

1. Install only `pg`, `drizzle-orm`, `drizzle-kit`, and needed TypeScript types;
   configure Drizzle for PostgreSQL and checked-in migrations.
2. Add DB connection/transaction helper using pooled `DATABASE_URL`, unpooled
   migration command using `DATABASE_URL_UNPOOLED`, bounded pool, clean shutdown,
   and no schema action at server startup.
3. Create first migration and typed schemas for: `organizations`, `users`,
   `teams`, `memberships`, `sessions`, `invitations`, `customers`,
   `customer_contacts`, `audit_events`, `outbox_events`, `idempotency_keys`.
   Add timestamps, UUIDs, tenant keys, core checks/FKs/unique indexes described
   in database doc; do not create future quote/inventory/billing tables yet.
4. Create two roles or document exact migration SQL for separate migration and
   runtime roles. Enable/force RLS on every tenant-owned table in this phase;
   runtime role must not own/bypass RLS.
5. Implement `withTenantTransaction(context, fn)` that performs `SET LOCAL`
   inside the transaction before tenant data access. It must reject a missing
   tenant ID; repositories must require an explicit transaction/context.
6. Add generic shared modules only for DB errors, ID generation, audit write,
   idempotency lookup/store, and pagination cursor primitives. Do not build a
   generic CRUD/repository framework.
7. Add idempotent fake development seed for two tenants with distinct users and
   minimal customers. It must not copy committed prototype password secrets or
   load `data.json` as production data.
8. Add migrations/seed/test scripts and integration tests on Neon: migration
   works, check/FK works, same tenant reads, cross-tenant data is blocked by RLS,
   missing tenant context fails, audit/idempotency unique rules work.

## Do not do in this phase

- Do not expose v1 signup/login routes or migrate existing legacy HTTP routes.
- Do not add product, quote, warehouse, order, subscription, invoice tables.
- Do not delete legacy local persistence; it remains demo-only until replacement
  phases achieve feature parity.
- Do not turn off RLS to make tests easier, use connection-wide `SET`, or grant
  application user schema-owner/superuser privileges.

## Validation

- Apply migration twice to disposable Neon database; second run is no-op.
- Run integration tests proving tenant A cannot select/insert/update tenant B
  through runtime role, including a deliberately unscoped repository attempt.
- Run seed twice and confirm it is idempotent.
- Run typecheck/lint/unit/integration scripts actually added; report results.
- Inspect migration SQL for no credentials/local paths and run `git diff --check`.

## Definition of done

- New persistence layer uses Neon PostgreSQL, checked-in migrations, and no
  runtime DDL.
- Tenant core/RLS/audit/outbox/idempotency foundations are tested on real Neon.
- No API behavior claims migration to Postgres yet; legacy demo is preserved.
- Future phase repositories have a safe tenant transaction context to use.

## Frontend handoff

None. Database schema is internal; the versioned frontend API is intentionally
not exposed until Phase 02.
