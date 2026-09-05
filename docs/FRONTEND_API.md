# DealFlow360 frontend API handoff

This is the frontend-facing contract. It describes the intended versioned API,
not the current proof-of-concept routes. The backend will generate OpenAPI 3.1
from the same Zod schemas; once published, OpenAPI is machine authority and
this file remains the readable guide.

## Frontend rules

1. Integrate new work only with `/api/v1`, never legacy prototype `/api` routes.
2. Render server money/status/risk/available actions. Do not calculate totals,
   margin, approval, price, availability, or proration as truth.
3. Send access JWT as `Authorization: Bearer <token>` from memory. Refresh is
   cookie-based. Never use localStorage or query strings for tokens.
4. Send `If-Match: W/"<revision>"` for editable quote/order/config mutations.
   On `409 VERSION_CONFLICT`, reload and let user reconcile.
5. Send a UUID `Idempotency-Key` for marked command POSTs. Reuse only to retry
   exactly the same request after network uncertainty.
6. Render buttons from `availableActions`; server authorization always wins.

## Common contract

- Base: `/api/v1`; probes: `/healthz` and `/readyz`.
- JSON: camelCase, UUID strings, ISO-8601 UTC timestamps.
- Money and quantity are decimal **strings**, for example `"1150.000000"`.
- One resource: `{ "data": { … } }`.
- List: `{ "data": [ … ], "page": { "limit": 25, "nextCursor": null } }`.
- Every list accepts `limit` (1–100) and opaque `cursor`, plus stated filters.

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The quote changed. Reload and try again.",
    "details": { "currentRevision": 8 },
    "requestId": "req_…"
  }
}
```

| Status | UI behavior |
| --- | --- |
| 400 | Show field errors from `details`; do not retry. |
| 401 | Try one refresh, then go to login. |
| 403 | Permission message; do not reveal internal data. |
| 404 | Treat unavailable/not shared; return to safe list. |
| 409 | Reload/reconcile for revision/stock/idempotency conflict. |
| 422 | Show business-state message, then refetch if useful. |
| 429 | Respect retry hint; throttle action. |
| 5xx | Preserve unsent form; retry safe command with same idempotency key. |

## Authentication/context

| Endpoint | Request | Response/use |
| --- | --- | --- |
| `POST /auth/login` | `{ email, password, organizationSlug? }` | Access token, user, active membership/organization; refresh cookie set. |
| `POST /auth/refresh` | refresh cookie | Rotated access/session. |
| `POST /auth/logout` | refresh cookie/token | `204`; clear local state. |
| `GET /me` | — | User, active organization, membership, permissions, notification count; call on boot. |
| `POST /auth/switch-organization` | `{ organizationId }` | New active context/token. |
| `POST /portal/auth/request-link` | `{ email, quoteShareToken? }` | Always `202`, no account existence clue. |
| `POST /portal/auth/exchange-link` | `{ token }` | Portal session/cookie and safe contact data. |
| `POST /portal/auth/login` | `{ email, password }` | Portal session/cookie. |

## Read-model rules

Internal Quote model contains `id`, number, status, revision, currency,
customer, owner, lines, totals, permitted profitability, risk, approval state,
`availableActions`, and timestamps. Line fields include product/variant IDs and
snapshotted `name`, `sku`, quantity, unitPrice, discountPct, taxRatePct,
billingType, line net/tax/total. Portal Quote omits profitability/cost/internal
risk/internal audit/internal comments/staff details.

Example fields:

```json
{
  "id": "uuid", "number": "Q-2026-000123", "status": "awaitingApproval",
  "revision": 7, "currency": "USD",
  "customer": { "id": "uuid", "name": "Acme Corp", "tier": "Gold" },
  "totals": { "subtotal": "2300.000000", "discount": "276.000000", "net": "2024.000000", "tax": "364.320000", "grandTotal": "2388.320000" },
  "risk": { "score": "4.500000", "level": "manager", "lineDetails": [] },
  "availableActions": ["sendToCustomer"]
}
```

## Configuration APIs (internal, tenant-scoped)

| Resource | Endpoints | Request/UI notes |
| --- | --- | --- |
| Customers/contacts | `GET/POST /customers`, `GET/PATCH /customers/:id`, `GET/POST /customers/:id/contacts` | Filter customer list by `q`, tier, status. Archive, do not hard-delete. |
| Catalogue | `GET/POST /product-categories`; `GET/POST /products`; `GET/PATCH /products/:id`; `POST/PATCH /products/:id/variants/:variantId` | Product input: SKU/category/unit/standard price/cost/tax/billing eligibility. |
| Pricing | `GET/POST /price-lists`; `GET/PATCH /price-lists/:id`; `PUT /price-lists/:id/items` | Bulk save atomically. Send product/variant + price only. |
| Governance | `GET/POST /customer-tiers`; `GET/POST /discount-policies`; `GET/PATCH /discount-policies/:id`; `POST /discount-policies/:id/publish`; same for `/approval-policies` | Published rules versioned; display server validation/rule preview. |
| Warehouse/inventory | `GET/POST /warehouses`; `GET/PATCH /warehouses/:id`; `GET /inventory/balances`; `POST /inventory/adjustments`; `GET /inventory/movements` | Inventory returns onHand/reserved/available. Adjustment needs reason. |
| Plans/rules | `GET/POST/PATCH /subscription-plans`; `GET/POST/PATCH /upsell-rules` | Configuration only. |
| Teams/members | `GET/POST /teams`; `PATCH /teams/:id`; `GET/POST /memberships`; `PATCH /memberships/:id`; `POST /auth/invitations` | Admin controls invites/roles. |

## Quotes and approvals (internal)

| Endpoint | Request | Response/UI behavior |
| --- | --- | --- |
| `GET /quotes` | `status`, `ownerId`, `teamId`, `customerId`, `productId`, `categoryId`, `from`, `to`, `sort`, cursor | Quote card list: number/customer/amount/status/risk/actions. |
| `POST /quotes` **idempotent** | `{ customerId, currency, expiresAt?, ownerMembershipId? }` | New draft quote. |
| `GET /quotes/:id` | — | Full internal quote. |
| `PATCH /quotes/:id` | Draft metadata + `If-Match` | Recalculated/revision-incremented quote. |
| `POST /quotes/:id/lines` | `{ productId, variantId?, quantity, discountPct, billingType, planId? }` + `If-Match` | Server resolves price/tax/cost; returns quote/totals/margin/risk/recommendations. |
| `PATCH /quotes/:id/lines/:lineId` | Intent fields + `If-Match` | Never submit price/tax/totals/cost snapshots. |
| `DELETE /quotes/:id/lines/:lineId` | `If-Match` | `204` or updated quote; refetch when body empty. |
| `GET /quotes/:id/recommendations` | `limit?` | Product, eligibility/promotion, displayed price, margin delta, score. |
| `POST /quotes/:id/submit` **idempotent** | `{ note? }` + `If-Match` | Frozen version; `200` auto-approved or `202` awaiting approval. |
| `GET /quotes/:id/approvals` | — | Ordered current/history steps and due time. |
| `POST /quotes/:id/approvals/:approvalId/decision` **idempotent** | `{ decision: "approve"|"reject"|"returnForRevision", reason }` | Reason required for reject/return; server rejects self/out-of-order/stale action. |
| `POST /quotes/:id/share` **idempotent** | `{ customerContactIds, expiresAt?, message? }` | Queues portal invitation/share. |
| `GET /quotes/:id/negotiation-requests` | — | Customer requests to resolve. |
| `POST /quotes/:id/negotiation-requests/:requestId/resolve` **idempotent** | `{ action: "acceptAsRevision"|"decline"|"requestClarification", message? }` | Acceptance creates revision, never direct price mutation. |
| `POST /quotes/:id/cancel` **idempotent** | `{ reason }` | Only before conversion. |
| `GET /quotes/:id/audit-events` | cursor | Redacted timeline. |

## Customer portal

| Endpoint | Request | Response/UI behavior |
| --- | --- | --- |
| `GET /portal/quotes` | status/cursor | Explicitly shared quotes only. |
| `GET /portal/quotes/:id` | — | Portal-safe quote and actions. |
| `POST /portal/quotes/:id/comments` **idempotent** | `{ lineId?, body }` | Portal-visible comment only. |
| `POST /portal/quotes/:id/negotiation-requests` **idempotent** | `{ changes, message? }` | Proposal against version; `202`; no direct total mutation. |
| `POST /portal/quotes/:id/accept` **idempotent** | `{ acceptedTermsVersion }` | Accepts exact version; transitions to approval or ready-for-order. |
| `GET /portal/orders`, `GET /portal/orders/:id` | cursor | Customer-safe fulfillment/invoice summary. |

## Orders, billing, health, reports

| Endpoint | Request/use |
| --- | --- |
| `POST /quotes/:id/convert-to-order` **idempotent** | Requires ready accepted version; creates one order snapshot. |
| `GET /orders`, `GET /orders/:id` | Filter status/customer/owner/date; scoped by caller. |
| `POST /orders/:id/fulfillment-plans/preview` | Optional objective weights; no stock reservation. |
| `POST /orders/:id/fulfillment-plans/confirm` **idempotent** | `{ planId }` or manual allocations + `If-Match`; reserves or returns `409` fresh plan. |
| `POST /orders/:id/shipments` **idempotent** | Warehouse/reservation IDs, carrier/tracking optional. |
| `POST /orders/:id/backorders/replan` **idempotent** | New plan from live availability. |
| `GET /subscriptions`, `GET /subscriptions/:id` | Subscription state, next bill, and `capabilities`. |
| `POST /subscriptions/:id/changes/preview` | `{ quantity?, discountPct?, unitPrice?, effectiveAt }` ISO-8601; no mutation. |
| `POST /subscriptions/:id/changes` **idempotent** | Same body + `If-Match`; applies change and debit/credit adjustment. |
| `POST /subscriptions/:id/cancel` **idempotent** | `{ effectiveAt, reason? }` + `If-Match`; credit/refund result. |
| `GET /invoices`, `GET /invoices/:id` | Filter `status`/`customerId`/`orderId`/`fromDate`/`toDate`; lines/adjustments/payments. |
| `POST /invoices/:id/record-payment` **idempotent** | Manual/demo only: `{ amount, paidAt, reference?, method: "manual" }`. Finance/admin. |

Billing notes:

- Mixed quote conversion creates a **draft** one-time invoice (issued on first shipment, Net-30) plus **active** subscriptions for recurring lines. Recurring invoices are independent of fulfillment.
- Responses include `capabilities.automaticCollectionEnabled` and `capabilities.recurringBillingAutomatic`. Both are `false` in this phase: no payment-provider sandbox and no worker process. Do not assume automatic collection.
- Display server preview/result only. Paid invoice lines are immutable; changes create adjustments, never rewrite issued lines.
| `GET /deal-health` | Alerts with reason/confidence/context. |
| `POST /deal-health/alerts/:id/nudge` **idempotent** | Optional message; notification queued. |
| `GET /reports/quotes`, `/reports/orders`, `/reports/sales` | JSON date/team/owner/status/product/category/currency filters. |
| `POST /report-exports` **idempotent**; `GET /report-exports/:id` | Queue/poll durable PDF/XLSX/CSV export. |

## SSE

`GET /events` is authenticated tenant-scoped SSE. Payload only has `eventId`,
`type`, `entityId`, `revision`, `occurredAt`; refetch entity after receipt.
Initial events: `quote.updated`, `quote.approvalRequested`,
`quote.approvalDecided`, `quote.negotiationRequested`, `order.updated`,
`inventory.changed`, `shipment.updated`, `invoice.updated`,
`subscription.updated`, `alert.created`, and `reportExport.completed`.
