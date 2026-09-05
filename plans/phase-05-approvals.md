# Phase 05 — Discount risk, quote submission, and approval workflow

**Status:** Planned  
**Depends on:** Phase 04 complete  
**Owner gate:** Verify configured demo discount/approval policy exists

## Required reading

- [README.md](README.md)
- [../docs/04-tenancy-auth-security.md](../docs/04-tenancy-auth-security.md)
- [../docs/05-database-design.md](../docs/05-database-design.md) — quote approvals
- [../docs/06-domain-workflows.md](../docs/06-domain-workflows.md) — risk/state machine
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md) — submit/approval endpoints

## Already done

- Prototype `risk.service.js` computes blended score and manager/finance route;
  quote confirmation/review records simple in-memory approvals.
- Phase 03 has published policy data and Phase 04 has persisted editable quote
  lines/revisions/snapshots.
- No immutable submitted quote version or v1 approval workflow exists.

## Do in this phase

1. Port risk evaluator to pure typed function with explicit input policy and
   detailed output: allowed/requested/overage per line, weighted score, max
   overage, order discount, reason codes, required ordered steps. Unit test the
   documented initial thresholds and policy variations.
2. Implement idempotent `POST /quotes/:id/submit`: lock current draft, validate
   state, freeze a new quote version with pricing/discount/approval snapshots,
   evaluate risk, create ordered steps or recorded auto-approval, update quote
   state/revision, audit, and outbox in one transaction.
3. Implement approval list and idempotent decision endpoints. Authorize only
   required role/assignee, prevent own-quote approval, enforce ordered pending
   step, require rejection/return reason, preserve decision actor/time/version.
4. Return-for-revision changes quote state but does not mutate frozen version;
   next submit freezes new version and invalidates/replaces pending old workflow.
   Rejection is terminal for version; explicit draft/revision handling follows
   workflow doc.
5. Add approval-inbox query filtered by caller role/team where useful, audit
   timeline API, notifications as durable outbox entries (delivery worker later),
   OpenAPI/fixtures/tests.

## Do not do in this phase

- Do not build portal sharing/customer negotiation, order conversion, stock,
  invoice, or real email worker/UI.
- Do not permit admin “force approve” without an explicit audited policy; admin
  must use defined step behavior.
- Do not reread live policy on an existing submitted version or edit decision
  history.

## Validation

- Unit-test none/manager/manager+finance route, category/tier minimum, line
  overage trigger, order-level trigger, empty/mixed quote, and rounding.
- Integration-test self approval, wrong role, wrong tenant, later-step-before-
  earlier, stale decision, return/revision, reject, auto approval, retry key.
- Confirm snapshot policy changes after submit do not alter route/audit history.
- Validate OpenAPI and run contract/Neon integration test suites.

## Definition of done

- Submission and every decision are immutable, ordered, tenant-safe, audited,
  idempotent/revision-safe, and explainable from stored snapshot data.
- No portal/order/inventory/billing behavior was introduced.

## Frontend handoff

Frontend can build submit state, approval inbox/detail, decision dialogs,
return/reject reason validation, and audit timeline. It must render server
steps/risk/status, not reproduce approval algorithm.
