# Testing, operations, and release standards

## Test layers

| Layer | Scope | Required examples |
| --- | --- | --- |
| Unit | Pure domain functions | rounding, price selection, risk, approval, allocation objective, proration. |
| Integration | Real Postgres on disposable Neon branch | migrations, checks/FKs, RLS, repository queries, transactions/locks, idempotency. |
| API contract | Zod/OpenAPI and Supertest | validation, response DTO, error envelope, pagination, authorization. |
| End-to-end | Staging API + frontend | each role's complete quote-to-payment/portal path. |
| Resilience/security | CI/manual staging | rate limit, redaction, expired token, webhook replay, backup, job retry. |

Mocks are fine for email/object/payment unit tests. They do not replace real
Postgres tests: RLS, constraints, locks, and numeric transactions need Neon.

## Required acceptance scenarios

1. Two tenants with same-looking records cannot access each other via API or
   repository error.
2. Owner invites rep/manager/finance/ops/contact, each with intended capability.
3. Admin configures prices/policies/warehouses/plan; rep mixed quote receives
   correct server totals/margin/recommendation.
4. Over-ceiling discount routes manager then finance; self/out-of-order approval
   fails; return + revision invalidates old steps.
5. Portal proposal cannot change approved terms; revision re-enters approval.
6. Customer acceptance/retried conversion creates exactly one order.
7. Concurrent allocation confirmation cannot oversell; ledger reconciles state.
8. Mixed order yields one-time/recurring data; change/cancel creates one
   deterministic adjustment; replay creates no duplicate.
9. Health alert/nudge is tenant-safe and delivery is marked only after success.
10. Export/auth/error/SSE work in staging; backup restore/migration rollout are
    rehearsed before production.

## Jobs/outbox

Do not claim automatic billing/email until a worker exists. When introduced,
command writes state + outbox in one transaction; worker claims/retries with
backoff; email/SSE/export/health/reservation-expiry/billing tasks are
idempotent; failures are monitored and safely replayable.

## CI quality gate

```text
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:contract
npm run build
```

Add a script only in the phase that implements it. CI uses disposable database
credentials, never production. Production migrations are approved release work.

## Operations/release

- Structured logs: request ID, safe tenant/actor IDs, route/status/duration,
  domain event/error cause—never secrets or raw PII.
- Monitor HTTP errors/latency, DB error/pool pressure, job lag/failure, outbox
  age, reservation expiry, invoice/webhook/email failures.
- Alert on readiness/migration/backup failure, 5xx spike, job backlog, webhook
  verification error.
- Runbooks: deployment/rollback, migration repair, outbox/job replay, session
  revocation, inventory correction, export recovery, Neon restore.

Production gate: environment validation, tenant/RLS tests, acceptance scenarios
in staging, versioned OpenAPI, monitoring and backup restore verified, no
default secret/seed/local DB in runtime, and owner-approved runbook.
