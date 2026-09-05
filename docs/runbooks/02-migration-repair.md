# Runbook: Database Migration Repair

## Purpose

Procedure for diagnosing failed database migrations, inspecting schema state, and applying forward corrective migrations without data loss or corruption.

---

## Core Principles

1. **Never edit an already-applied migration file**: Migration files committed to git and executed in any environment are immutable history.
2. **Never run destructive down-migrations in production**: Rollbacks are accomplished via forward corrective migrations.
3. **Always use unpooled connection strings**: DDL and schema migrations must execute via `DATABASE_URL_UNPOOLED` directly against Postgres, never via PgBouncer.

---

## Diagnostic Steps

### 1. Check Migration Log / Table

Drizzle stores applied migrations in the `__drizzle_migrations` table:

```sql
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT id, hash, created_at
FROM \"__drizzle_migrations\"
ORDER BY created_at DESC
LIMIT 10;
"
```

### 2. Inspect Schema Drift

To compare current database schema against TypeScript schema definitions:

```bash
cd backend
npx drizzle-kit check
```

---

## Remediation Procedure

### Scenario A: Migration Failed Midway

If a migration fails halfway through execution:
1. Examine the exact Postgres error message from `npm run db:migrate`.
2. Inspect whether the transaction rolled back cleanly. PostgreSQL supports transactional DDL (`CREATE TABLE`, `ALTER TABLE`, `ADD COLUMN` are rolled back automatically on error).
3. If an uncommitted lock or unlogged statement caused partial application:
   - Connect via `psql "$DATABASE_URL_UNPOOLED"`
   - Check if any new tables/columns were left in place:
     ```sql
     SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
     ```
   - If the migration recorded an entry in `__drizzle_migrations`, check its hash.

### Scenario B: Applying a Corrective Forward Migration

1. Update the Drizzle TypeScript schema files in `src/db/schema/` to the intended state.
2. Generate a new migration file:
   ```bash
   npx drizzle-kit generate
   ```
3. Inspect the newly created SQL file in `drizzle/` to verify:
   - It only makes additive or safe non-locking alterations.
   - It adds appropriate defaults or nullable constraints.
   - It does NOT drop existing active columns.
4. Test the migration on an isolated disposable Neon branch:
   ```bash
   DATABASE_URL="$DISPOSABLE_NEON_UNPOOLED" npm run db:migrate
   ```
5. Apply to target staging/production:
   ```bash
   DATABASE_URL="$DATABASE_URL_UNPOOLED" npm run db:migrate
   ```
