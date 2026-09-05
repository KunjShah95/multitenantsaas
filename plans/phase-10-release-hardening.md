# Phase 10 — Security, performance, operations, and release readiness

**Status:** Complete  
**Depends on:** Phases 00–09 complete for the selected release scope  
**Owner gate:** Staging host/secrets/monitoring access and production-release decision

## Required reading

- [README.md](README.md)
- [../docs/00-owner-setup.md](../docs/00-owner-setup.md)
- [../docs/02-technology-decisions.md](../docs/02-technology-decisions.md)
- [../docs/04-tenancy-auth-security.md](../docs/04-tenancy-auth-security.md)
- [../docs/08-testing-operations.md](../docs/08-testing-operations.md)
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md)

## Already done

- Earlier phases should provide v1 modules, migrations/RLS, API contract, test
  layers, audit/outbox, and features selected for this release.
- Current proof of concept has no validated staging deployment, backup restore,
  rate/performance profile, secret scanner, operational runbook, or production
  release gate.

## Do in this phase

1. Inventory all runtime config/dependencies/routes; remove only verified dead
   prototype paths after v1 feature parity and frontend migration confirmation.
   Do not delete user data/files without explicit owner approval.
2. Run security review: tenant/RLS query audit, role/ownership tests, secret
   scan, dependency audit, CORS/cookie/header/rate-limit validation, PII/log
   redaction review, token/webhook/download URL tests, and least-privilege DB
   role verification.
3. Add or complete CI gates for typecheck/lint/unit/integration/contract/build,
   migration validation on disposable Neon branch, and selected e2e flows.
4. Exercise performance/concurrency: quote list/report query `EXPLAIN ANALYZE`,
   realistic pagination, connection pool behavior, concurrent stock/approval/
   idempotency tests. Add only evidenced indexes/limits.
5. Deploy staging using secret store/environment validation, run full acceptance
   scenarios in `docs/08-testing-operations.md`, verify health/readiness,
   structured logs/error tracking/metrics/alerts, and frontend v1 integration.
6. Rehearse Neon backup/restore and migration forward/corrective migration
   procedure. Write runbooks for deploy/rollback, job/outbox replay, session
   revocation, inventory correction, export recovery, and incident contacts.
7. Produce release report: exact features enabled/deferred, database migration
   version, test results, known limitations/free-tier constraints, rollback plan,
   required owner approval. Update docs only for verified final behavior.

## Do not do in this phase

- Do not add unplanned features, change product rules, migrate to a new
  framework/database/vendor, or enable payment live mode merely to “finish”.
- Do not change Neon/free provider plan, expose production secret, run destructive
  reset, delete backups, or clean production data without explicit owner approval.
- Do not claim production readiness if worker/backup/RLS/e2e prerequisites are
  not actually verified.

## Validation

- All applicable acceptance scenarios in `docs/08-testing-operations.md` pass
  in staging with recorded command/output or test run link.
- Restore a non-production staging backup into an isolated database and verify
  readable migration/data integrity; never test destructive restore on source.
- Demonstrate two-tenant security test, bearer/session revocation, failed
  provider/webhook path, stale revision/idempotency retry, and concurrent stock.
- Verify ready/health, logs redaction, error capture, DB connection behavior,
  alert destination, and rollback/runbook readability.

## Definition of done

- Release scope is explicitly documented and all enabled features are tested in
  staging with operations evidence.
- Security/RLS/backup/restore/migration/observability/runbook conditions pass.
- Owner receives a truthful go/no-go report, limitations, cost/free-tier check,
  rollback instructions, and no unapproved destructive or paid action occurred.

## Frontend handoff

Frontend receives final versioned OpenAPI URL/artifact, staging base URL, known
feature flags/deferred capabilities, error/status compatibility confirmation,
and test accounts through secure channel only. No passwords or secrets are put
in the repository or handoff document.
