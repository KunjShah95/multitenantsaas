# Runbook: Deployment and Rollback

## Purpose

Standard operating procedure for deploying releases to staging/production and executing an immediate zero-data-loss rollback in the event of an outage or regression.

---

## Pre-Deployment Checklist

1. [ ] Target branch passes all CI checks: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:contract`, `npm run build`.
2. [ ] If database migrations exist, verify they are backward-compatible with the currently running application version.
3. [ ] Confirm staging acceptance scenarios passed.
4. [ ] Verify all required environment variables are set in the target deployment environment (see `docs/00-owner-setup.md`).
5. [ ] Create a Neon point-in-time branch or verify the project's automatic backup timestamp before deploying DDL changes.

---

## Deployment Procedure

### Step 1: Run Database Migrations (if applicable)

Always apply migrations using the direct (unpooled) database URL:

```bash
cd backend
DATABASE_URL="$DATABASE_URL_UNPOOLED" npm run db:migrate
```

*Verify*: Confirm migration exited with status 0. If migrations fail, STOP deployment immediately.

### Step 2: Build and Deploy Application Container/Host

```bash
# Build the production bundle
npm ci --omit=dev
npm run build

# Start the application server
NODE_ENV=production node dist/server.js
```

### Step 3: Verify Deployment Health

Check HTTP health probes:

```bash
# 1. Liveness
curl -f -i https://api.yourdomain.com/healthz
# Expected: 200 OK, {"status":"ok","app":"DealFlow360"}

# 2. Readiness (checks DB connectivity)
curl -f -i https://api.yourdomain.com/readyz
# Expected: 200 OK, {"status":"ok","db":"ok"}

# 3. OpenAPI Spec check
curl -f -i https://api.yourdomain.com/api/v1/openapi.json
# Expected: 200 OK, Content-Type: application/json
```

---

## Rollback Procedure

When an issue occurs in production:

### 1. Application Rollback

1. Re-deploy the previously known good commit/container image immediately.
2. Verify `/healthz` and `/readyz` return `200 OK`.

### 2. Database Migration Rollback Rules

> [!CAUTION]
> **Never run `DROP TABLE` or `DROP COLUMN` in a panicked rollback.**
> Database migrations follow expand/contract rules:
> - New columns must be nullable or have safe defaults.
> - The old application code will simply ignore the new columns/tables.
> - Rolling back the application code does NOT require rolling back the database schema if backward compatibility was observed.

If a corrective schema change is required, follow [02-migration-repair.md](02-migration-repair.md).
