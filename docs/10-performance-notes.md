# Performance and Concurrency Notes

This document details the database access patterns, concurrency controls, indexing strategy, and connection pooling behavior for DealFlow360 v1.

---

## 1. Connection Architecture (Neon Lakebase Postgres)

DealFlow360 runs on Neon Serverless Postgres with dual connection strings:

| Connection String | Target | Purpose | Pooler |
|---|---|---|---|
| `DATABASE_URL` | Pooled endpoint (`-pooler.region.neon.tech`) | All application queries, HTTP requests, API traffic | PgBouncer (transaction pooling) |
| `DATABASE_URL_UNPOOLED` | Direct endpoint (`.region.neon.tech`) | Migrations, DDL, schema checks, advisory locks | Direct connection |

### PgBouncer Transaction Pooling Constraints

> [!IMPORTANT]
> Neon's pooled endpoint uses **transaction-level pooling**. The following PostgreSQL features do NOT persist across transactions and MUST NOT be used on `DATABASE_URL`:
> - Drizzle schema migrations (`drizzle-kit migrate`) — runs DDL across multi-statement scripts that need session locks.
> - `pg_advisory_lock()` across multiple transactions — locks belong to the backend connection, which PgBouncer reassigns.
> - `SET LOCAL` or connection-level `LISTEN/NOTIFY`.
> 
> The codebase enforces this: migrations are run via unpooled credentials, while all API transactions run on the pooled connection.

### Cold Starts and Scale-to-Zero

- Neon branches scale to zero when idle.
- First request after idle incurs a ~500ms–1.5s cold start while compute resumes.
- The readiness probe (`GET /readyz`) executes `SELECT 1` with a 2-second timeout.
- Synthetic health checks should ping `/healthz` (which does not hit the DB) for liveness, and `/readyz` for traffic readiness.

---

## 2. Concurrency Controls & Row Locking

### Concurrent Inventory Allocation (`SELECT ... FOR UPDATE`)

To prevent stock overselling during simultaneous quote acceptances:
1. Balance rows are locked using `SELECT ... FOR UPDATE`.
2. To avoid deadlocks under concurrent transactions touching multiple SKUs, rows are locked in a **deterministic order**:
   ```sql
   SELECT * FROM inventory_balances
   WHERE tenant_id = $1 AND warehouse_id = $2 AND sku_key = ANY($3)
   ORDER BY warehouse_id ASC, sku_key ASC
   FOR UPDATE;
   ```
3. Available quantity (`on_hand_qty - reserved_qty - allocated_qty`) is evaluated inside the transaction. If available < requested, an `INSUFFICIENT_STOCK` error is raised and the transaction rolls back without side effects.

### Optimistic Concurrency Control (Revisions)

Mutable commercial aggregates (`quotes`, `orders`, `subscriptions`) use an integer `revision` column:
- Every update checks `WHERE id = $1 AND tenant_id = $2 AND revision = $3`.
- If 0 rows are updated, the service throws `VERSION_CONFLICT` (HTTP 409).
- Clients re-fetch the latest state before retrying modifications.

### Idempotency Key deduplication

Commands that perform payments, order creation, or external dispatches accept an `Idempotency-Key` header:
- Keys are stored in `idempotency_keys` with a unique constraint on `(tenant_id, idempotency_key, request_path)`.
- Concurrent duplicate requests either await the in-flight lock or return the cached response payload.

---

## 3. High-Volume Query Patterns & Evidenced Indexes

### 1. Quotes List (Cursor Pagination)

**Pattern**:
```sql
SELECT id, number, status, revision, currency, total_amount, created_at
FROM quotes
WHERE tenant_id = $1
  AND ($2::text IS NULL OR status = $2)
  AND ($3::timestamptz IS NULL OR (created_at, id) < ($3, $4))
ORDER BY created_at DESC, id DESC
LIMIT $5;
```

**Index**:
- `quotes_tenant_status_created_idx`: `(tenant_id, status, created_at DESC, id DESC)`
- Satisfies tenant filter, optional status filter, and keyset pagination ordering without an in-memory filesort.

### 2. Approval Policy Matching

**Pattern**:
```sql
SELECT * FROM approval_policies
WHERE tenant_id = $1
  AND status = 'published'
  AND is_active = true
ORDER BY priority ASC, created_at DESC;
```

**Index**:
- `approval_policies_tenant_status_idx`: `(tenant_id, status, is_active)`
- Fast lookup for candidate policies during discount tier evaluation.

### 3. Outbox Event Dispatch

**Pattern**:
```sql
SELECT id, aggregate_type, aggregate_id, event_type, payload, retry_count
FROM outbox_events
WHERE status = 'pending'
  AND retry_count < 5
ORDER BY created_at ASC
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

**Index**:
- `outbox_events_status_retry_idx`: `(status, retry_count, created_at ASC)`
- Enables high-throughput worker consumption without lock contention via `SKIP LOCKED`.

### 4. Audit Trail Search

**Pattern**:
```sql
SELECT * FROM audit_events
WHERE tenant_id = $1
  AND aggregate_type = $2
  AND aggregate_id = $3
ORDER BY created_at DESC
LIMIT 50;
```

**Index**:
- `audit_events_tenant_aggregate_idx`: `(tenant_id, aggregate_type, aggregate_id, created_at DESC)`

---

## 4. Staging EXPLAIN ANALYZE Execution Guide

To capture live execution plans on staging:

```bash
# Connect using psql to the staging unpooled URL
psql "$DATABASE_URL_UNPOOLED"
```

Run the following queries with tenant parameters substituted:

```sql
-- Set tenant RLS context
SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000001';

-- 1. Keyset pagination on quotes
EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING)
SELECT id, number, status, total_amount, created_at
FROM quotes
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- 2. Aggregation for pipeline report
EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING)
SELECT status, count(*), sum(total_amount)
FROM quotes
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
GROUP BY status;

-- 3. Warehouse balance lock
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM inventory_balances
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND warehouse_id = '00000000-0000-0000-0000-000000000002'
ORDER BY sku_key ASC
FOR UPDATE;
```

**Acceptance criteria**:
- Execution times for single-tenant index-backed queries must remain under **10ms** on realistic staging datasets (< 100k rows).
- Aggregations should utilize Index Only Scans or Bitmap Index Scans where possible; no Sequential Scans on unpartitioned multi-tenant tables.
