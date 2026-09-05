# Technology decisions: free, minimal, and developer-friendly

## Approved choices

| Concern | Chosen option | Cost/license/DX rationale |
| --- | --- | --- |
| Database | **Neon PostgreSQL** | Current $0 development/demo tier, standard PostgreSQL, branching, and pooling. Postgres is essential for transactions, row locking, foreign keys, reporting, and RLS. |
| API runtime | Node.js 22+ and **Express 5** | Reuse the working framework rather than introducing a new server framework. |
| Language | TypeScript with strict mode | Free tooling; catches DTO/domain mistakes before runtime. Convert incrementally. |
| Database access | `pg`, `drizzle-orm`, `drizzle-kit` | Free/open source, typed schema, checked-in SQL migrations, and direct SQL escape hatch for locks/RLS/reporting. |
| Validation | `zod` | Already present, free, and usable for requests, environment, and OpenAPI schemas. |
| API docs | `@asteasolutions/zod-to-openapi` + Swagger UI | Generate OpenAPI from server schemas; avoid a manually duplicated contract. |
| Password hashing | `argon2` | Established free/open-source Argon2id implementation; no custom crypto. |
| Tokens | `jose` or existing `jsonwebtoken`, behind one auth module | Keep one library only; short access JWT plus opaque refresh session in Postgres. |
| Logging | `pino` | Lightweight structured JSON logs. |
| Tests | Vitest + Supertest | Free, fast Node developer experience. |
| Formatting/lint | ESLint + Prettier | Minimal shared rules; run in CI. |
| Background jobs | None early; `pg-boss` when recurring work begins | Avoid Redis/queue infrastructure before it is actually needed. |
| Email | Adapter interface; Resend free tier for demo/staging | Domain logic stays provider-neutral. |
| Files/exports | No storage before needed; Cloudflare R2 for durable exports | S3-compatible, free usage allowance, no egress charge. |
| Realtime | SSE after workflow APIs are stable | Browser-native and lower-complexity than WebSockets. |

## PostgreSQL/Neon, not MongoDB Atlas

DealFlow360 has relational, financial, and concurrency-sensitive transactions:
quote versions + approvals, inventory reservations + movements, orders +
invoices, and tenant-filtered reporting. PostgreSQL supplies foreign keys,
check constraints, precise numerics, explicit transactions, row locks, and
row-level security. MongoDB would make those safeguards application-only and
make the report/query model less robust.

Use Neon as the single Postgres service, not as a custom database abstraction.
It is suitable for development and a small demo, but free limits must be
rechecked before production. On 5 September 2026 Neon listed 0.5 GB storage and
100 CU-hours per project on its Free plan. [Neon pricing](https://neon.com/pricing)

## Environment model

| Environment | Database | Data rule |
| --- | --- | --- |
| Development | Dedicated Neon project or branch | Fake/demo data only; no local DB. |
| Test | Temporary Neon branch/project | Created for integration tests and deleted/expired afterwards. |
| Staging | Protected Neon project/branch | Synthetic production-like configuration; frontend integration target. |
| Production | Separate Neon project | Dedicated credentials, backups, monitoring, no seed accounts. |

The API uses pooled `DATABASE_URL`. Migrations/administrative jobs use unpooled
`DATABASE_URL_UNPOOLED`. Do not migrate on web-server startup; run once through
CI/CD.

## Optional services, delayed by need

1. **Email:** Phase 2 has `ConsoleEmailAdapter` for development and an adapter
   interface. Enable Resend only when invite/magic-link delivery is tested. Its
   documented free tier is 3,000 emails/month and 100/day, not an unlimited
   production promise. [Resend pricing](https://resend.com/pricing)
2. **Object storage:** Do not upload documents in the MVP. When asynchronous
   PDF/XLSX/CSV needs durable files, add `ObjectStorage` and use R2. Its current
   free tier lists 10 GB-month storage, 1M Class A and 10M Class B operations.
   [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
3. **Worker:** Free hosting may suspend a web process. A manually triggered demo
   schedule is not a reliable financial scheduler. Add `pg-boss` plus a
   continuously running worker only when recurring billing/notifications ship.

## Dependency discipline

Add a package only when it removes substantial custom code or provides a
security-critical primitive.

- Do not add NestJS, Prisma, Redis, GraphQL, a CQRS framework, microservices,
  or a message broker for this modular Express application.
- Do not add multiple ORMs, validation libraries, date libraries, money
  libraries, or generic repository frameworks.
- Use Postgres constraints, JSONB, full-text search, and transactions before
  adding a search/cache/queue service.
- Prefer native `fetch`, `crypto`, `URL`, `AbortController`, and Express 5's
  promise-aware error flow before adding utility packages.

## Migration convention

```text
db/schema/                 TypeScript table definitions by domain
db/migrations/             generated, checked-in SQL migrations
db/migrate.ts              explicit migration command, never app startup
db/seed-demo.ts            idempotent fake-data seed for development only
```

1. Change schema declaration.
2. Generate readable SQL, inspect it, commit schema and migration.
3. Apply it to a disposable Neon branch in CI.
4. Apply to staging/production through the release pipeline once.
5. Never edit a migration already used in shared environments; write a
   corrective migration. [Drizzle migrations](https://orm.drizzle.team/docs/migrations)

## Required environment contract

```text
NODE_ENV
PORT
DATABASE_URL
DATABASE_URL_UNPOOLED             # migration/CI only
JWT_ACCESS_SECRET
SESSION_PEPPER
APP_ORIGIN
PORTAL_ORIGIN
EMAIL_PROVIDER_API_KEY             # optional until enabled
EMAIL_FROM                         # optional until enabled
OBJECT_STORAGE_*                   # optional until enabled
PAYMENT_WEBHOOK_SECRET             # optional until enabled
ERROR_TRACKING_DSN                 # optional, recommended before staging
```

Validate values at boot with Zod. Production fails closed for required secrets.
Never retain a default JWT secret or seed password in executable code.
