# DealFlow360 Backend — Architecture

Flow: Quote → RiskScore → Approval(manager,finance) → Fulfillment(split) → Billing(hybrid) → Portal(negotiate→re-approval) → Reports

```
[Rep/Admin] → POST /api/quotes + /lines → risk.service.evaluateQuote()
   tierCeiling(Gold=15) vs categoryCeiling(Hardware=15, Services=10)
   allowed=min(tier,category); over=max(0,given-allowed)
   score=weightedAvgOver + 0.5*maxOver [+order excess]; >5 or maxOver≥8 → MANAGER_FINANCE
   → status pending_approval → /review (manager, finance) + auditLog
   → /fulfillment/plan (split.service: cheapest-weight first) → /decide (override ok, decrements stock)
   → order + billing.service.buildSchedule() (oneTime vs recurring, prorated)
[Customer role] → /api/portal/quotes (own only) → /negotiate (comment+counter) → reeval → /confirm (re-approval if needed)
[Manager] → /api/health (stalled>7d, discount anomaly vs rep avg±2σ, backorder slippage) + /nudge
[Ops/Finance] → /api/orders/:id/invoice → /invoices/:id/pay; /:id/subscriptions/:lid/cancel → creditNotes
[Reports] → /api/reports/quotes?from,to,ownerId,status,productId,category&format=csv
```

Data model: users(role) | customers(tier) | products(category,price,unitCost) | priceLists(tier rules)
 | tierCeilings | categoryCeilings | warehouses(stock, shippingCostWeight) | plans | upsellRules(trigger,suggested,weight,promoted,minMargin)
 | quotes(lines,risk,approvals[],comments[],fulfillment) | orders | invoices | creditNotes | auditLog(actor,action,at,reason)

Roles enforced by middleware/auth.js (JWT + requireRole). Customer portal is a separate router
that can only access its own customerId quotes — not an internal screen relabeled.

Run: `npm install && node index.js` (seed: rep@dealflow.io/rep123, manager/mgr123, finance/fin123, admin/admin123, buyer@acme.com magic). Verify: `npm run verifyAll` (8-step Login→Payment + new-gaps suite: variants, currency/tax, chains CRUD, sub modify, pdf/xls, teams, portal signup).

Persistence: SQLite via node:sqlite (`data.db`, table store+meta) with JSON backup (`data.json`).

Next with more time: multi-currency payments, stock reservations, refresh tokens, PDF layout upgrade.
