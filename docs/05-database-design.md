# PostgreSQL database design

Read [04-tenancy-auth-security.md](04-tenancy-auth-security.md) before adding
tables or repository queries. Every tenant-owned table carries `tenant_id` and
is RLS-protected.

## Global conventions

- Use UUID primary keys plus separate human document numbers (`Q-…`, `O-…`,
  `INV-…`).
- Use UTC `timestamptz`; consistently name `created_at`, `updated_at`,
  `archived_at`.
- Money/quantity: `numeric(20,6)` and ISO currency. API returns decimal
  strings; binary floating-point never decides money.
- Check constraints enforce non-negative values, valid percentages, intervals,
  and state values. Use JSONB for snapshots/conditions/provider payloads and
  addresses, not searchable relational data.
- Mutable aggregates have `revision integer not null default 1`.
- Archive referenced configuration/products. Never hard-delete commercial,
  financial, audit, or inventory-movement evidence.

## Table map

| Domain | Tables | Key rules |
| --- | --- | --- |
| Tenant/identity | `organizations`, `users`, `memberships`, `teams`, `sessions`, `invitations` | Users are global; membership unique per tenant/user; session stores token hash only. |
| Customer/catalogue | `customers`, `customer_contacts`, `product_categories`, `products`, `product_variants`, `customer_tiers` | Unique tenant SKU/warehouse/customer refs; archive references. |
| Commercial configuration | `price_lists`, `price_list_items`, `discount_policies`, `discount_tier_limits`, `discount_category_limits`, `approval_policies`, `approval_policy_steps`, `subscription_plans`, `upsell_rules` | Version/publish policies and effective price windows. |
| Quotes | `quotes`, `quote_versions`, `quote_lines`, `quote_approvals`, `quote_comments`, `negotiation_requests`, `quote_shares` | Submitted/accepted terms are immutable version snapshots. |
| Inventory/fulfillment | `warehouses`, `inventory_balances`, `inventory_reservations`, `inventory_movements`, `fulfillment_plans`, `fulfillment_allocations`, `shipments` | Movement immutable; reserve only under row lock. |
| Order/billing | `orders`, `order_lines`, `subscriptions`, `subscription_changes`, `invoices`, `invoice_lines`, `adjustments`, `payments` | Order/financial records snapshot quote lines; never edit paid invoice line. |
| Operations | `audit_events`, `outbox_events`, `notifications`, `idempotency_keys`, `report_exports` | Audit/outbox/idempotency written transactionally with command. |

## Critical aggregate design

### Quotes

`quotes` stores customer/owner/currency/status/current-version/revision/current
display totals. Editable `quote_lines` include product/variant IDs **and
snapshots**: name, SKU, category, unit, cost, price, tax, billing mode, and
currency. Product changes cannot alter historical evidence.

`quote_versions` contains immutable commercial/pricing/discount-policy/
approval-policy snapshots plus source policy IDs/versions/evaluation result.
`quote_approvals` links to one version and has unique sequence. A partial unique
index prevents two active workflows for one quote.

### Pricing/policies

`price_lists` have tenant/currency/customer tier nullable/priority/effective
range/status. `price_list_items` has product/variant price per list. Server
resolves tenant + currency + tier + date + priority then snapshots decision.

`discount_policies`/`approval_policies` are draft/published/versioned.
Publishing validates coverage, percentage/step/range rules. Never overwrite a
published policy used by a submitted quote.

### Inventory

`inventory_balances` unique key is `(tenant_id, warehouse_id, sku_key)`, with
`on_hand_qty`, `reserved_qty`, `allocated_qty`, reorder point/revision.
`available = on_hand - reserved - allocated` is calculated server-side.

Confirmation locks balance rows in stable warehouse/SKU order with `SELECT …
FOR UPDATE`, checks available amount, creates reservations/movement, updates
balance, then commits. Preview is read-only and may become stale.

### Finance

`orders`/`order_lines` snapshot accepted quote version. `subscriptions` retain
billing anchor/timezone, plan/price/tax snapshot, current period/next bill.
`invoices` have immutable lines/subtotal/discount/tax/total/balance/status.
`adjustments` are debit/credit/refund records rather than edits to paid history.

## Required indexes and constraints

- Every tenant table begins query indexes with `tenant_id`.
- Quotes/orders: `(tenant_id, status, updated_at desc)` plus owner/team query
  composites. Active health statuses use partial updated-at index.
- Inventory: unique balance key; active reservations by expiry; movements by
  SKU key/occurred time. Subscriptions: active `next_bill_at`.
- Idempotency: unique `(tenant_id, actor_id, operation, key)`; provider event
  references are unique by provider/external ID.
- Enforce `quote_lines.quantity > 0`, percentages `[0,100]`, nonnegative
  financial total except explicit credit/refund, and interval end > start.
- Run `EXPLAIN (ANALYZE, BUFFERS)` before speculative performance indexes.

## Migration and seed rules

1. Migrations are checked-in SQL generated/reviewed through Drizzle.
2. Runtime API never mutates schema.
3. Development seed is idempotent fake-only: demo tenant, roles, catalogue,
   warehouses, and workflow data.
4. Do not migrate `data.db`/`data.json` into production. A disposable dev
   importer is optional only if demo data saves effort.
5. Test constraints/RLS/locks against actual Neon Postgres, never mocks alone.
