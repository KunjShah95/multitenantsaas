# Phase 07 — Order conversion, inventory reservations, allocations, and shipment

**Status:** Planned  
**Depends on:** Phase 06 complete  
**Owner gate:** Confirm demo warehouses/opening balances are configured

## Required reading

- [README.md](README.md)
- [../docs/03-backend-architecture.md](../docs/03-backend-architecture.md)
- [../docs/05-database-design.md](../docs/05-database-design.md) — inventory/order tables
- [../docs/06-domain-workflows.md](../docs/06-domain-workflows.md) — fulfillment only
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md) — order/fulfillment only

## Already done

- Phase 03 has tenant warehouse config/balance opening metadata.
- Phase 06 creates ready-for-order accepted quote version.
- Prototype can auto-split and directly decrement in-memory warehouse stock;
  it has no transaction/reservation/ledger/concurrency safety.

## Do in this phase

1. Add schemas/migrations/repositories for orders/order lines, inventory
   balances/reservations/movements, fulfillment plans/allocations, and shipments.
   Order/lines snapshot accepted quote version; movement history is immutable.
2. Implement idempotent quote-to-order conversion. Lock/read ready accepted
   version, prevent duplicate conversion, copy commercial snapshot, create order
   in `orderCreated`, audit/outbox, return v1 order DTO.
3. Implement pure allocation preview optimizer. It prefers one usable warehouse,
   otherwise minimizes documented shipment count/shipping weight/backorder
   penalty; returns allocations/backorders/reasons/estimated costs/snapshot time
   and does not write any inventory state.
4. Implement idempotent allocation confirmation for selected or manual plan.
   Require `If-Match`; lock affected balance rows in deterministic order, validate
   availability/product/variant/warehouse/quantity, create reservations and
   movements/projection updates, update order/plan status/audit/outbox. If stale
   stock, return 409 with safe fresh preview rather than partial writes.
5. Implement shipment command that validates reservation/warehouse, converts
   reserved stock into immutable shipped movement, updates shipment/order status,
   and supports partial shipment. Implement backorder replan as new plan, never
   historical allocation rewrite.
6. Add configuration inventory-adjustment compatibility, RLS/role controls,
   OpenAPI, fixtures, unit optimizer tests, transactional concurrency tests.

## Do not do in this phase

- Do not reduce stock in browser or through unvalidated direct PATCH.
- Do not add carrier label purchasing, procurement/replenishment, ERP sync,
  actual delivery confirmation integration, or invoice/subscription billing.
- Do not release/reserve stock in separate transactions or silently change
  shipped/historical allocations during replan.

## Validation

- Test conversion retry produces exactly one order; unauthorized/ineligible quote
  cannot convert.
- Unit-test optimizer one warehouse, split, no stock/backorder, cost tie, product
  variant separation, deterministic output.
- Integration-test manual invalid allocation, stale revision, wrong warehouse,
  insufficient stock, reservation release/replan, partial shipment, audit rows.
- Run concurrent confirmation tests for last unit. Exactly one transaction may
  reserve it; second returns conflict and no negative/phantom balance exists.

## Definition of done

- Accepted quote becomes one immutable order snapshot through v1 API.
- Allocation preview is read-only; confirmation is atomic, idempotent, tenant/
  role safe, row-locked, auditable, and non-overselling.
- Inventory movements explain every balance change; no billing/carrier scope
  entered.

## Frontend handoff

Frontend can display order list/detail, allocation preview, manual allocation,
stock conflict/reload, backorder and shipment status. It must treat preview as
advisory and confirmed response as authoritative.
