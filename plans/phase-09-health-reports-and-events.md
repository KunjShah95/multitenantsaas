# Phase 09 — Deal health, reports, export lifecycle, notifications, and SSE

**Status:** Planned  
**Depends on:** Phase 08 complete  
**Owner gate:** Decide whether durable export files require Cloudflare R2; confirm worker availability for automated scans/delivery

## Required reading

- [README.md](README.md)
- [../docs/00-owner-setup.md](../docs/00-owner-setup.md)
- [../docs/05-database-design.md](../docs/05-database-design.md) — operations tables
- [../docs/06-domain-workflows.md](../docs/06-domain-workflows.md) — health/report rules
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md) — health/report/SSE
- [../docs/08-testing-operations.md](../docs/08-testing-operations.md)

## Already done

- Prototype reports quotes and simple health alerts synchronously from memory;
  it emits PDF/XLS response bodies and supports an in-memory nudge comment.
- Earlier phases have tenant-owned quote/order/invoice data, audit/outbox, and
  optionally job worker foundations. No durable alert/export/SSE feature exists.

## Do in this phase

1. Add persisted alerts/notifications/report-exports schema if absent. Health
   scan calculates stalled active quotes, explainable discount anomaly with
   minimum sample/confidence, delivery/backorder slippage, overdue billing;
   stores reason/context/source time and deduplicates active alert.
2. Implement role/tenant-scoped `GET /deal-health`, idempotent nudge command,
   notification state, and worker/outbox delivery path. If no worker, expose
   explicit protected manual scan/nudge path for demo; do not claim automation.
3. Implement server report queries for quotes/orders/sales with date/team/owner/
   approval/product/category/currency filters, cursor/limits, permission scopes,
   and documented aggregates. Use explicit SQL/read repository and tested
   indexes; never unbounded in-memory report processing.
4. Implement export request/status lifecycle. For small demo export, generate
   synchronously only if bounded. For durable large export, use worker + R2
   adapter/private object/short-lived signed URL/expiry. Never public object or
   stored PII URL. Update plan/docs based on owner choice.
5. Implement authenticated tenant SSE from outbox events. Payload is only
   event ID/type/entity ID/revision/time; client refetches. Support reconnect
   via Last-Event-ID or documented bounded replay; never stream full records.
6. Add tests for filters/roles/tenant separation, alert reasoning/dedupe, nudge
   delivery state, export access/expiry, event leakage/reconnect, OpenAPI docs.

## Do not do in this phase

- Do not add generic analytics warehouse/BI tool, custom report-SQL builder,
  ML scoring, push-notification/mobile app, public R2 bucket, or WebSocket
  framework.
- Do not make dashboard read model alter commercial/stock/billing decisions.
- Do not add untested timers pretending to be durable worker jobs.

## Validation

- Test stalled/anomaly/backorder/overdue alert with time-controlled fixtures,
  sample-size confidence and dedupe/reopen behavior.
- Test report filters, pagination, totals, unauthorized and cross-tenant access.
- Test export request retry/access/expiry and no private object URL leakage.
- Test SSE authentication/tenant isolation/small payload/reconnect/refetch flow.

## Definition of done

- Health/report/export/event APIs are role/tenant safe, bounded, auditable, and
  documented; automation claims match actually deployed worker capability.
- No new business workflow or external analytics scope was added.

## Frontend handoff

Frontend can build dashboard, filterable reports, export progress/download, and
SSE-driven cache invalidation. It must refetch after event and never interpret
event payload as complete resource state.
