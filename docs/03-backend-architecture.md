# Backend architecture and engineering standards

## Architecture

```text
SPA / Customer Portal
        |
  Express v1 controllers
  auth -> tenant context -> role/ownership check -> Zod validation
        |
  application/domain service (one command/query)
        |
  repository + PostgreSQL transaction
        |                     |
  Neon PostgreSQL        audit event + transactional outbox
                                      |
                              worker/email/SSE/export adapter
```

The application is a modular monolith: one deployable API and one database.
Modules are separated by domain boundary, not network calls.

## Target source layout

```text
src/
  app/                  app creation, middleware, routes, health/readiness
  api/v1/               controller + request/response schema per domain
  auth/                 sessions, password, magic link, permissions
  tenancy/              organization context and RLS transaction helper
  domain/
    catalog/ quotes/ approvals/ portal/ inventory/ billing/ health/
  db/
    schema/ migrations/ repositories/ transaction.ts seed-demo.ts
  integrations/         email, object storage, payment adapters
  events/               audit/outbox/SSE publisher
  shared/               API errors, money, ids, dates, pagination, logging
tests/
  unit/ integration/ contract/ e2e/ fixtures/
```

Keep a domain module cohesive: schema, repository, service, controller, OpenAPI
response, and tests belong together. Do not create a generic `utils` folder
that becomes a second architecture.

## Responsibilities

| Layer | Must do | Must not do |
| --- | --- | --- |
| Controller | Parse input, get actor/context, call one use case, map typed error to HTTP. | Calculate totals, make authorization guesses, build SQL, or mutate workflow inline. |
| Domain service | Enforce state/role rules, invoke repositories in needed transaction, produce events/results. | Know Express request/response or hard-code vendor SDK. |
| Repository | Run focused queries, lock rows, map persistence rows. | Decide approval policy or expose unscoped tenant reads. |
| Integration adapter | Send email, persist object, verify provider payload. | Alter business state without returning to a service. |

## Command/query rules

- Commands change state and have clear verbs: `submitQuote`, `decideApproval`,
  `confirmAllocation`, `applySubscriptionChange`.
- Queries only read and are tenant/role-scoped: `listQuotes`, `getQuoteDetail`.
- Each command owns its transaction. Aggregate changes, audit event, idempotent
  response, and outbox event are written in that transaction.
- Retriable commands use `Idempotency-Key`; editable aggregates use `revision`
  and `If-Match`. See [FRONTEND_API.md](FRONTEND_API.md).
- Price/tax/risk/proration functions are pure and accept an injected clock.

## Error handling

All errors have one envelope:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The quote changed. Reload and try again.",
    "details": { "currentRevision": 8 },
    "requestId": "req_..."
  }
}
```

| Error family | HTTP | Examples |
| --- | --- | --- |
| Validation | 400 | malformed JSON, invalid enum, missing field |
| Authentication | 401 | expired/missing token/session |
| Authorization/not visible | 403 or 404 | disallowed action; non-visible resource normally 404 |
| State rule | 422 | approving an already rejected quote |
| Concurrency/conflict | 409 | stale revision, idempotency reuse, stock conflict |
| Dependency | 502/503 | email/object/payment provider unavailable |
| Unexpected | 500 | logged with request ID; no implementation detail leaked |

The final Express error middleware serializes unexpected errors. Controllers do
not use arbitrary `try/catch` strings.

## Validation, DRY, and code quality

- Zod validates every body, path/query parameter, environment value, and
  webhook. Strict command schemas reject unknown properties unless documented.
- Validate business rules after shape validation. A valid allocation can still
  be illegal for current state or unavailable in stock.
- Clients submit intent/IDs; never totals, risk, cost, price snapshot, stock,
  invoice status, or membership role.
- Create shared code only for a stable concept used three times or for a central
  correctness/security primitive. Good examples: money, pagination, API errors,
  idempotency, transaction context, permissions, audit, outbox, and clock.
- Avoid generic CRUD controllers/repositories, universal entity services,
  inheritance frameworks, dynamic rule DSLs, and generic event buses.
- New production code is strict TypeScript with no unchecked `any`; external
  input stays `unknown` until parsed. Prefer named types and status unions.
- Use explicit tenant filter/column lists in repository queries. Log no secrets,
  raw payment payloads, reset links, or unnecessary PII.
- A feature is complete only with route, schemas, service, repository/migration
  when needed, tests, and API docs. No dead stubs or unused packages.
