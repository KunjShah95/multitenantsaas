# Phase 00 — Owner setup and engineering foundation

**Status:** Planned  
**Depends on:** Nothing  
**Owner gate:** Required before database/application work

## Required reading

- [README.md](README.md)
- [../docs/00-owner-setup.md](../docs/00-owner-setup.md)
- [../docs/02-technology-decisions.md](../docs/02-technology-decisions.md)
- [../docs/03-backend-architecture.md](../docs/03-backend-architecture.md)

## Already done

- The repository has a JavaScript Express 5 proof of concept, Zod, JWT,
  prototype services, local seed data, and verification scripts.
- The owner has selected Neon PostgreSQL and the free/open-source stack.
- `docs/` and `plans/` now provide the authoritative design and execution plan.

## Owner prerequisites (do these yourself)

1. Complete every checked item in [00-owner-setup.md](../docs/00-owner-setup.md).
2. Create a Neon development project and put its pooled/direct connection URLs
   in untracked root `.env`; do not send the values to an agent.
3. Generate distinct `JWT_ACCESS_SECRET` and `SESSION_PEPPER` values.
4. Tell the agent: “Phase 00 prerequisites are ready; `.env` has both Neon
   URLs and secrets; frontend dev origin is `<origin>`.” Do not paste secrets.

If this confirmation is absent, the agent may create `.env.example` and safe
tooling but must not run migrations or simulate a local database.

## Do in this phase

1. Inspect existing `.gitignore`, package scripts, and all user changes.
2. Add/update `.gitignore` to exclude `.env`, `.env.*` while retaining
   `!.env.example`, provider credential files, local DB files, coverage/build
   output, and no broad patterns that hide source migrations.
3. Add root `.env.example` containing exactly the non-secret names from
   `docs/00-owner-setup.md`, safe placeholders, and comments identifying
   phase-deferred optional values. Do not create/modify tracked `.env`.
4. Add a strict environment validation module that only requires values needed
   by current runtime. It must fail clearly in production and avoid breaking
   existing prototype start before Phase 1 database integration.
5. Introduce TypeScript incrementally: `tsconfig.json`, `tsx`/build/typecheck
   scripts, and a minimal `src/` entry or adapter. Do not convert every legacy
   module in this phase.
6. Add ESLint/Prettier/Vitest/Supertest/Pino only if each is configured and
   immediately used. Add `typecheck`, `lint`, `test:unit`, and `test:contract`
   scripts only after their files exist.
7. Add `/healthz` (process alive) and `/readyz` (safe dependency readiness;
   database check may be deferred until Phase 1) with one error envelope and
   request-ID middleware.
8. Write a short root README section linking `docs/README.md`, `plans/PHASES.md`,
   setup instructions, and scripts actually available after this phase.

## Do not do in this phase

- Do not add PostgreSQL schema, run data migration, enable RLS, or delete
  `utils/db.js`, `data.db`, `data.json`, or legacy routes.
- Do not change product workflows, endpoints, authentication behavior, or
  frontend contract.
- Do not add optional email/R2/payment/error-tracking packages or a job queue.
- Do not put real values in `.env.example`, docs, tests, or Git.
- Do not rewrite the proof of concept into TypeScript wholesale.

## Validation

- Confirm `git check-ignore .env` ignores root `.env` and
  `git check-ignore .env.example` does **not** ignore template.
- Run every newly added script and the existing `npm run verifyAll` if legacy
  server setup allows it; state exact commands/results.
- Verify `/healthz` returns `200` and `readyz` has documented behavior before
  Neon integration.
- Check `git diff --check`, no secret appears in diff, and lint/typecheck pass
  if added.

## Definition of done

- Owner setup confirmation is recorded in task handoff without secrets.
- Environment template/ignore rules are correct and root `.env` remains
  untracked.
- Minimal quality/runtime foundation exists without breaking the legacy demo.
- README points agents/frontend to the relevant docs and current commands.
- No business feature, cloud schema, or optional provider was added.

## Frontend handoff

None. Existing prototype API remains unchanged; frontend must wait for the v1
contract produced in later phases.
