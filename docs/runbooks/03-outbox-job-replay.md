# Runbook: Outbox Event and Job Replay

## Purpose

Procedure for inspecting the transactional outbox table (`outbox_events`), identifying failed or stuck asynchronous jobs (emails, webhooks, analytics, sync events), and safely replaying them without duplicate side effects.

---

## Background & Architecture

DealFlow360 uses the **Transactional Outbox Pattern**:
- When a domain aggregate changes (e.g. quote approved, order accepted), the state change and the corresponding domain event are committed in the **same database transaction**.
- A worker or outbox dispatcher claims pending rows with `FOR UPDATE SKIP LOCKED`.
- Handlers MUST be idempotent: downstream consumers handle deduplication via event IDs.

---

## 1. Inspecting Outbox Status

Connect to the database and check the current outbox queue health:

```sql
-- Count events by status
SELECT status, count(*), min(created_at) as oldest_event
FROM outbox_events
GROUP BY status;

-- Find recently failed events
SELECT id, tenant_id, aggregate_type, aggregate_id, event_type, retry_count, last_error, created_at
FROM outbox_events
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;

-- Identify stuck 'processing' events (in flight > 15 minutes)
SELECT id, tenant_id, aggregate_type, event_type, created_at
FROM outbox_events
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '15 minutes';
```

---

## 2. Unsticking Hung Events

If an outbox dispatcher crashed while processing an event, the status may remain `'processing'`:

```sql
UPDATE outbox_events
SET status = 'pending',
    updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '15 minutes';
```

---

## 3. Safely Replaying Failed Events

Once the root cause (e.g. downstream SMTP provider outage, third-party webhook timeout) is resolved:

### Option A: Replay specific event by ID
```sql
UPDATE outbox_events
SET status = 'pending',
    retry_count = 0,
    last_error = NULL,
    updated_at = NOW()
WHERE id = 'EVENT_UUID_HERE'
  AND status = 'failed';
```

### Option B: Batch replay failed events for a specific event type
```sql
UPDATE outbox_events
SET status = 'pending',
    retry_count = 0,
    last_error = NULL,
    updated_at = NOW()
WHERE event_type = 'quote.approved'
  AND status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

---

## 4. Poison Pill Management (Discarding Malformed Events)

If an event payload is fundamentally invalid and cannot be processed:
```sql
UPDATE outbox_events
SET status = 'dead_letter',
    last_error = 'Discarded manually by operator: malformed payload',
    updated_at = NOW()
WHERE id = 'POISON_EVENT_UUID';
```
Record the incident and aggregate ID in the operational log for audit tracking.
