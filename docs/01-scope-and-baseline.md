# Scope and current baseline

## Product outcome

DealFlow360 is a multi-tenant B2B sales-operations SaaS. It must support the
flow below without making the frontend the source of truth:

```text
configure -> quote -> price/risk -> approval -> portal negotiation
          -> accepted quote -> order -> stock reservation/shipment
          -> one-time invoice + recurring billing -> health/reporting
```

The backend owns calculations, authorization, workflow transitions, audit
evidence, and persistence. The frontend owns rendering, form state, navigation,
and clear presentation of server-returned totals/statuses/actions.

## Tenant boundary

An `organization` is a tenant. Its products, price lists, customers,
warehouses, users' memberships, quotes, orders, invoices, and reports belong
to that organization only. A global user identity can have memberships in more
than one organization, but one request is always executed in one active
organization.

## Current proof-of-concept inventory

| Existing location | What already works as a demo | Why it cannot remain the production implementation |
| --- | --- | --- |
| `index.js` | Express router composition and basic health endpoint | No API versioning, environment validation, readiness, or operational middleware. |
| `modules/auth.js` + `middleware/auth.js` | JWT login/signup and portal login | Request-controlled roles, default secret, long bearer lifetime, no sessions/tenant membership/invites, and simplified magic login. |
| `modules/catalog.js` | Products, variants, prices, policies, warehouses, plans, teams | No tenant scoping, relational constraints, archiving/versioning, or fine-grained authorization. |
| `modules/quotes.js` + `services/*.js` | Quote, risk, recommendations, allocation, proration, totals | Valuable prototype, but snapshots, concurrency, ownership checks, transactions, and immutable workflow evidence are missing. |
| `modules/portal.js` | Quote view, comments, counteroffer, confirmation | Counteroffer directly changes a quote line and share/contact permissions are insufficient. |
| `modules/ops.js` | Reports, health, invoice/payment demo endpoints | Reports/invoices are in-memory; no worker, provider boundary, durable export, or tenant filtering. |
| `utils/db.js` | Seed data and SQLite/JSON fallback | Process-local Maps plus `data.db`/`data.json` are not cloud-safe or multi-instance safe. |
| `verify.js`, `verify2.js` | Seed of end-to-end assertions | Must be extended by unit, integration, contract, and staged end-to-end tests. |

Existing domain services are valuable as **test examples**, not as code to copy
unchanged. Preserve successful demo behavior only when it agrees with
[06-domain-workflows.md](06-domain-workflows.md).

## First-release scope

- Organization, internal roles, customer contacts, and secure portal access.
- Catalogue, variants, customer tiers, effective price lists, discount and
  approval policy configuration.
- Quote builder with server-resolved prices, margin, totals, suggestions,
  versioned submission, approvals, audit history, and controlled negotiation.
- Order conversion, multi-warehouse allocation preview/confirmation, inventory
  reservation/movement ledger, backorders, and shipment status.
- Mixed one-time/recurring billing, proration previews/apply, adjustment notes,
  demo payment recording, and a payment-provider boundary.
- Deal-health alerts, reports, exports, notifications, OpenAPI contract,
  testing, and a staging-ready runbook.

## Explicit non-goals for the first release

- MongoDB, local SQLite, JSON files, or browser storage as authoritative data.
- Carrier label purchase, ERP/accounting/CRM sync, supplier procurement, or
  automatic replenishment.
- ML-trained recommendations; configured upsell/cross-sell rules are enough.
- Full multi-country tax/accounting compliance, e-signature, unrestricted
  customer file uploads, custom report-SQL builder, offline/native apps, or a
  second event-sourced store.
- Live payment capture before provider/webhook/refund requirements are approved.

## Terms

| Term | Meaning |
| --- | --- |
| Quote version | Immutable snapshot of offered terms and policies at submission/acceptance. |
| Quote draft | Editable current working representation before submission. |
| Negotiation request | Customer proposal against a quote version; never a direct mutation. |
| Reservation | Temporarily committed available stock for an order allocation. |
| Inventory movement | Immutable stock-ledger entry; balances are a projection. |
| Adjustment | Debit, credit, or refund record; it never edits a paid invoice line. |
| Outbox event | Event written with domain state, delivered asynchronously. |

For precise transitions, use [06-domain-workflows.md](06-domain-workflows.md).
