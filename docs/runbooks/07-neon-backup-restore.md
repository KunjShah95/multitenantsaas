# Runbook: Neon Backup, Point-in-Time Restore, and Disaster Recovery

## Purpose

Procedure for disaster recovery, point-in-time recovery (PITR), and rehearsing backup restoration using Neon's copy-on-write branching architecture.

---

## Neon Storage & Backup Architecture

Neon provides storage-level continuous backups with instant branching:
- **Zero-cost Copy-on-Write**: Creating a branch from a parent branch or historical timestamp takes seconds and does not copy physical data blocks until writes occur.
- **Point-in-Time Recovery (PITR)**: You can create a branch at any arbitrary timestamp (e.g. `2026-09-05T12:00:00Z`) within the retention window.

---

## 1. Safety Directives

> [!CRITICAL]
> **NEVER execute a destructive restore directly on the active production branch.**
> 1. Always restore to a **new, isolated branch** first (e.g. `restore-20260905-1200`).
> 2. Run data integrity checks and migration verification against the restored branch.
> 3. Only point application traffic to the restored branch after explicit owner sign-off.

---

## 2. Rehearsal / Point-in-Time Branch Creation

Using the Neon CLI or Neon Console:

### Step 1: Create a Restore Branch at a Specific Timestamp

```bash
# Using Neon CLI
neon branches create \
  --project-id "$NEON_PROJECT_ID" \
  --name "restore-rehearsal-$(date +%s)" \
  --parent "main"

# Or create from a specific point in time (PITR):
neon branches create \
  --project-id "$NEON_PROJECT_ID" \
  --name "restore-pitr-test" \
  --parent "main" \
  --timestamp "2026-09-05T10:00:00Z"
```

### Step 2: Obtain Connection String for Restored Branch

```bash
neon connection-string "restore-pitr-test" --project-id "$NEON_PROJECT_ID"
```

### Step 3: Run Integrity & Migration Validation on the Restored Branch

```bash
# Verify connection
psql "$RESTORED_BRANCH_UNPOOLED" -c "SELECT count(*) FROM organizations;"

# Check migration status
psql "$RESTORED_BRANCH_UNPOOLED" -c "
SELECT id, hash, created_at FROM \"__drizzle_migrations\" ORDER BY created_at DESC LIMIT 5;
"

# Run schema validation
cd backend
DATABASE_URL="$RESTORED_BRANCH_UNPOOLED" npx drizzle-kit check
```

---

## 3. Disaster Recovery Switchover Procedure

If production data was corrupted or accidentally deleted and recovery to a restored branch is approved:

1. **Place application into maintenance mode**: Stop API traffic or return `503 Service Unavailable`.
2. **Verify final state of restored branch**: Check record counts for `organizations`, `quotes`, `orders`, and `audit_events`.
3. **Update production environment variables**:
   - Update `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in the hosting secrets store (e.g. GitHub Secrets, Fly.io, Railway, Kubernetes) to the restored branch endpoints.
4. **Restart backend server containers**.
5. **Verify health probes**:
   - `curl https://api.yourdomain.com/healthz`
   - `curl https://api.yourdomain.com/readyz`
6. **Resume traffic and monitor structured error logs**.
7. **Clean up**: Retain the corrupted original branch for 30 days under an archived name (`archived-corrupt-main-20260905`) for forensic audit before deletion.
