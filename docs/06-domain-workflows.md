# Domain workflows and invariants

## Server-owned calculations

The client sends choices and requested quantity/discount. The server resolves
price, tax, cost snapshot, totals, margin, risk, approval route, inventory,
and proration. Refer to [FRONTEND_API.md](FRONTEND_API.md) for the commands.

### Price, tax, and margin

1. Resolve price list by tenant, tier, currency, product/variant, date, and
   explicit priority.
2. Snapshot product name/SKU/category/cost/price/tax/unit/billing fields onto
   quote line.
3. Compute quantity × price -> line discount -> optional order discount ->
   taxable net -> tax -> grand total in one money module with tested rounding.
4. Margin uses snapshotted discounted net minus snapshotted cost and is never
   in a portal DTO.

### Discount risk and approval

```text
allowed(line) = min(customer-tier ceiling, category ceiling)
overage(line) = max(0, requested discount - allowed(line))
weightedOverage = sum(overage × line gross) / quote gross
riskScore = weightedOverage + 0.5 × maximum line overage
          + documented order-level excess penalty
```

Initial policy can retain prototype thresholds: score zero auto-approves;
positive score up to manager threshold needs manager; above threshold, one line
eight points over, or order discount ten points above tier needs manager then
finance. Thresholds/steps are versioned published policy data, not controllers.

Submission freezes quote/policy snapshots and ordered steps. Future policy
changes cannot alter it. No self-approval, no out-of-order decision; reject or
return needs reason; revision invalidates pending old steps.

## Quote and portal state machine

```text
draft -> submittedForApproval -> awaitingApproval -> approvedInternal
  ^           |                    |                    |
  |           v                    v                    v
  +--- returnedForRevision       rejected          sharedWithCustomer
                                                      |
                                                     underNegotiation
                                                      |
                         negotiation proposal -> revision -> draft

approvedInternal/sharedWithCustomer -> customerAccepted
customerAccepted -> awaitingApproval (if needed) | readyForOrder -> converted
draft/sharedWithCustomer/underNegotiation -> cancelled | expired
```

- Counteroffer is `negotiation_request` against base version, never line edit.
- Rep accepts proposal by creating a revision and normal resubmission.
- Acceptance is for exactly one shared immutable version. Conversion separately
  creates one idempotent order.
- Post-conversion commercial change is an order amendment/change workflow, not
  quote mutation.

## Fulfillment and inventory

```text
orderCreated -> allocationPlanned -> stockReserved -> packing
                                      |                 |
                                      v                 v
                                   backordered     partiallyShipped -> shipped -> delivered
```

Preview prefers one warehouse then minimizes shipment count, configured cost
weight, and backorder penalty. It returns allocation/backorders/reasons/cost
estimate/inventory timestamp without modifying stock.

Confirmation validates selected/manual plan in one transaction. It locks stock,
validates product/variant and warehouse, creates reservation/movement, and can
return `409 INSUFFICIENT_STOCK` with fresh preview. Shipment consumes reservation
into immutable movement. Replan preserves historic shipment/reservation data.

## Subscription, invoice, and payment

- Converted mixed order creates one-time invoice candidate and recurring
  subscription instances; their invoice schedules are independent.
- Subscription stores anchor/timezone/interval/price-tax snapshot/current
  period/next billing/cancellation/proration policy.
- Change first returns preview; apply locks subscription/current period,
  calculates deterministic remaining-period delta, records change, creates
  debit/credit adjustment if needed.
- Cancellation follows plan policy and creates refund/credit. Paid invoice line
  remains immutable.
- Webhooks verify raw-body signature and are idempotent before status change.

## Health, reports, notifications

- Health detects stalled quotes, explainable sufficiently-sampled discount
  anomalies, backorder/delivery slippage, and overdue/failed billing.
- Alerts persist source time/reason/context. Nudge writes audit + notification/
  outbox; it is sent only after adapter success.
- Reports are tenant/role-filtered read models. Large exports are async with
  expiry; small results are JSON.

## Universal mutation invariants

1. Editable aggregate mutation checks current revision/`If-Match`.
2. Retriable business, financial, and stock commands require idempotency key.
3. State change, audit event, and outbox event are one transaction.
4. Audit/commercial/financial snapshots are append-only.
5. Server returns `availableActions`; UI does not infer status permissions.
