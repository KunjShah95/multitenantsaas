# DealFlow360 — Multi-tenant SaaS (Phase 02 complete → Phase 03 ready)

> **Current phase:** 02 complete — Neon + Auth foundation live on `src/`. Legacy JS prototype (`index.js`/`modules/*`/`utils/*`/`services/*`/`verify*.js`/`data.*`) removed 2026-09-05 before Phase 03. All runtime paths now use TypeScript + Neon PostgreSQL.

## Documentation

- **Design authority:** [`docs/README.md`](docs/README.md) — index of all authoritative docs
- **Owner setup (read first):** [`docs/00-owner-setup.md`](docs/00-owner-setup.md) — Neon project, `.env` creation, secrets generation
- **Technology decisions:** [`docs/02-technology-decisions.md`](docs/02-technology-decisions.md) — approved stack, free-tier limits, migration convention
- **Backend architecture:** [`docs/03-backend-architecture.md`](docs/03-backend-architecture.md) — modular monolith, layer responsibilities, error envelope
- **Frontend contract:** [`docs/FRONTEND_API.md`](docs/FRONTEND_API.md) — versioned `/api/v1` contract (future), probes, auth rules
- **Execution plan:** [`plans/PHASES.md`](plans/PHASES.md) and [`plans/phase-00-owner-and-foundation.md`](plans/phase-00-owner-and-foundation.md)

## Setup (Phase 00)

1. **Owner prerequisites** (required before DB work) — see `docs/00-owner-setup.md`:
   - Create Neon dev project `dealflow360-dev` and copy **pooled** `DATABASE_URL` + **direct** `DATABASE_URL_UNPOOLED` into untracked `.env`.
   - Generate two distinct secrets: `JWT_ACCESS_SECRET`, `SESSION_PEPPER` (`openssl rand -base64 48` twice).
   - Tell the agent: “Phase 00 prerequisites are ready; `.env` has both Neon URLs and secrets; frontend dev origin is `<origin>`.” Do not paste secrets.

2. **Local bootstrap:**

    ```sh
    cp .env.example .env   # fill pooled/direct URLs and generated secrets
    npm install
    npm run typecheck
    npm run lint
    npm run test:unit
    npm run test:contract
    npm run dev            # TypeScript foundation (src/index.ts → :4000)
    ```

## Scripts (available after Phase 02)

| Script | Purpose |
|---|---|
| `npm run dev` | Watch-run TypeScript foundation (`tsx watch src/index.ts`) |
| `npm start` | Run TypeScript foundation (`tsx src/index.ts`) |
| `npm run build` | Compile `src/` → `dist/` via `tsc` |
| `npm run typecheck` | `tsc --noEmit` strict check |
| `npm run lint` / `lint:fix` | ESLint (flat config, typescript-eslint) |
| `npm run format` / `format:fix` | Prettier check/write |
| `npm run test` / `test:unit` / `test:contract` | Vitest + Supertest (unit & contract) |
| `npm run db:migrate` / `db:seed` | Apply migrations / idempotent demo seed (Neon) |

## Probes

- `GET /healthz` — liveness, always `200 { status:"ok" }`
- `GET /readyz` — readiness, checks Neon pool when `DATABASE_URL` is set

All errors use one envelope: `{ error: { code, message, details?, requestId } }` and `x-request-id` is echoed/set on every response. See `docs/03-backend-architecture.md` and `src/shared/errors.ts:1`.

## Environment

Template at `.env.example` (tracked) with safe placeholders; real `.env` is git-ignored. Validation in `src/config/env.ts:1` (Zod) fails closed in `NODE_ENV=production` and tolerates missing `DATABASE_URL` in development until Phase 1 — so `npm run dev:ts` starts without a DB.

## What Phase 02 completed

- Neon PostgreSQL with Drizzle migrations, RLS-ready tenant isolation, audit/outbox/idempotency (`src/db/*`)
- Secure auth: Argon2id, JWT access + opaque refresh rotation, sessions, invitations, portal magic-link, RBAC middleware (`src/auth/*`, `src/api/v1/auth*`)
- Legacy prototype fully removed — no `utils/db.js`, `data.db`, or alternative persistence remains
