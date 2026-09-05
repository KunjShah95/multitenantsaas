# Runbook: Report Export Recovery

## Purpose

Procedure for diagnosing, re-triggering, or canceling stuck or failed asynchronous report exports (e.g. CSV/PDF quote exports, billing summaries, inventory valuation reports).

---

## 1. Inspecting Export Status

Query the `report_exports` table:

```sql
-- Find failed or in-progress exports
SELECT id, tenant_id, report_type, status, created_at, completed_at, error_message
FROM report_exports
WHERE status IN ('failed', 'processing', 'pending')
ORDER BY created_at DESC
LIMIT 20;

-- Find stuck exports (processing > 30 minutes)
SELECT id, tenant_id, report_type, created_at
FROM report_exports
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

---

## 2. Resetting / Re-queueing a Stuck Export

If an export process terminated abruptly (e.g. out-of-memory or worker restart):

```sql
UPDATE report_exports
SET status = 'pending',
    error_message = NULL
WHERE id = 'EXPORT_UUID'
  AND status = 'processing';
```

If the job needs to be re-run by a worker or client:
- The user can trigger a fresh export via `POST /api/v1/reports/exports` with the original report parameters.
- Mark the abandoned export record as failed:
  ```sql
  UPDATE report_exports
  SET status = 'failed',
      error_message = 'Timed out; superseded by new request',
      completed_at = NOW()
  WHERE id = 'EXPORT_UUID';
  ```

---

## 3. Storage and Cleanup Policy

- Export files stored in Neon Object Storage / S3 have a time-to-live (TTL) of 7 days.
- Pre-signed download URLs expire in 15 minutes.
- If a client reports an expired download link, generate a new signed URL via the API without regenerating the underlying file.
