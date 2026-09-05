# DealFlow360 — Multi-tenant SaaS (Phase 00 foundation)

> **Current phase:** 00 — Owner setup and engineering foundation. Legacy JS proof-of-concept remains in `index.js`/`modules/*`; new TypeScript foundation lives in `src/`.

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
   npm run dev:ts         # TypeScript foundation (src/index.ts → :4000)
   # or legacy demo (still works):
   npm run dev            # nodemon index.js → :4000
   npm run verifyAll      # 8-step legacy Login→Payment demo against live server
   ```

## Scripts (available after Phase 00)

| Script | Purpose |
|---|---|
| `npm run dev:ts` | Watch-run TypeScript foundation (`tsx watch src/index.ts`) |
| `npm start` / `npm run dev` | Legacy JS demo server (`index.js`) — preserved until Phase 1 |
| `npm run build` | Compile `src/` → `dist/` via `tsc` |
| `npm run typecheck` | `tsc --noEmit` strict check |
| `npm run lint` / `lint:fix` | ESLint (flat config, typescript-eslint) |
| `npm run format` / `format:fix` | Prettier check/write |
| `npm run test` / `test:unit` / `test:contract` | Vitest + Supertest (unit & contract) |
| `npm run verifyAll` | Legacy end-to-end demo (requires running server) |

## Probes

- `GET /healthz` — liveness, always `200 { status:"ok" }`
- `GET /readyz` — readiness, Phase 0 returns `200` with `{ database: deferred }` until Neon integration (Phase 1 adds real pool check)
- `GET /health` — legacy alias kept for `verify.js`

All errors use one envelope: `{ error: { code, message, details?, requestId } }` and `x-request-id` is echoed/set on every response. See `docs/03-backend-architecture.md` and `src/shared/errors.ts:1`.

## Environment

Template at `.env.example` (tracked) with safe placeholders; real `.env` is git-ignored. Validation in `src/config/env.ts:1` (Zod) fails closed in `NODE_ENV=production` and tolerates missing `DATABASE_URL` in development until Phase 1 — so `npm run dev:ts` starts without a DB.

## What Phase 00 does NOT do

- No PostgreSQL schema, RLS, or migration (Phase 1)
- No workflow/endpoint/auth behavior changes
- No email/R2/payment/queue packages
- No wholesale rewrite of `utils/db.js`, `data.db`, `data.json`, or legacy routes
