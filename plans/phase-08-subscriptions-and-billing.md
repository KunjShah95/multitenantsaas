# Phase 08 — Subscriptions, proration, invoices, payments, and billing jobs

**Status:** Planned  
**Depends on:** Phase 07 complete  
**Owner gate:** Decide whether this phase remains manual/demo payment only or select payment provider sandbox/webhook

## Required reading

- [README.md](README.md)
- [../docs/00-owner-setup.md](../docs/00-owner-setup.md)
- [../docs/05-database-design.md](../docs/05-database-design.md) — billing tables
- [../docs/06-domain-workflows.md](../docs/06-domain-workflows.md) — subscription/billing
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md) — billing endpoints
- [../docs/08-testing-operations.md](../docs/08-testing-operations.md) — jobs/outbox

## Already done

- Prototype calculates simplified schedule/proration/cancellation in memory and
  records invoice/payment without provider/idempotency/ledger.
- Phase 07 produces immutable mixed order line snapshots with recurrent billing
  intent, but no subscription/invoice tables.

## Do in this phase

1. Add subscriptions/subscription changes, invoices/invoice lines, adjustments,
   payments, and job state/migration schema. Store billing anchor/timezone,
   plan/currency/price/tax snapshots, current period/next bill, immutable invoice
   lines/totals/balances/status and provider external IDs.
2. On order conversion/billing initialization, create one-time invoice candidate
   plus active subscriptions for recurring lines idempotently. Define exactly
   when one-time invoice is issued relative to fulfillment and test it.
3. Implement pure schedule/proration functions with injected clock/date zone:
   preview subscription change/cancellation, then idempotent apply using lock on
   subscription/current period. Create debit/credit/refund adjustment rather
   than editing issued/paid invoice lines.
4. Implement secured subscription/invoice reads, preview/apply/cancel commands,
   manual finance/admin `record-payment`, audit/outbox, decimals/error contract,
   and OpenAPI fixtures.
5. If owner supplied provider sandbox, add a narrow provider interface and one
   signature-verified raw-body webhook route. Persist/dedupe provider event
   before updating payment/invoice. If not supplied, explicitly ship manual
   demo-payment boundary only; do not fake live payment.
6. Introduce `pg-boss` only if a continuously running worker/deployment plan is
   available. Implement idempotent recurring invoice due-job and retry policy;
   otherwise keep schedule generation/manual trigger and mark automatic billing
   deferred in API/docs.

## Do not do in this phase

- Do not collect raw card data, enable live provider, mutate paid invoice line,
  add accounting ledger/ERP sync/tax compliance, or promise automatic jobs on a
  suspended free web process.
- Do not generate PDFs/exports/health reports/SSE; those are Phase 09.
- Do not use client date/money as billing authority.

## Validation

- Test monthly/quarterly/yearly anchors, boundary dates/timezones, positive and
  negative proration, cancel/refund policies, precision, and idempotency retry.
- Test one order with one-time + recurring lines creates exactly intended records.
- Test unauthorized tenant/role access, stale subscription change, duplicate
  payment/provider event, immutable paid invoice line, audit/outbox behavior.
- If worker/provider enabled, test retry/webhook raw signature/deduping against
  sandbox; otherwise document manual-only limitation in release output.

## Definition of done

- Mixed order billing is persisted, snapshot-based, decimal-safe, idempotent,
  auditable, and controllable via v1 API.
- Subscription change/cancel never rewrites financial history.
- Live payment/automatic billing exists only if owner prerequisites and tested
  worker/provider are present; otherwise the limitation is explicit.

## Frontend handoff

Frontend can build subscriptions, schedule, proration preview/apply, cancel,
invoice detail, and finance manual-payment screens. Display server preview/result
only; show whether automatic collection is enabled instead of assuming it.
