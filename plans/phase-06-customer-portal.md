# Phase 06 — Customer portal shares, controlled negotiation, and acceptance

**Status:** Planned  
**Depends on:** Phase 05 complete  
**Owner gate:** Decide console-email versus configured Resend sender for invitation delivery

## Required reading

- [README.md](README.md)
- [../docs/04-tenancy-auth-security.md](../docs/04-tenancy-auth-security.md)
- [../docs/05-database-design.md](../docs/05-database-design.md) — portal tables
- [../docs/06-domain-workflows.md](../docs/06-domain-workflows.md) — negotiation/state machine
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md) — portal only

## Already done

- Phase 02 provides customer contact and portal session/magic-link identity.
- Phase 05 has internally approved immutable quote versions.
- Prototype portal can list/view/comment/negotiate/confirm but mutates lines
  directly and is not share-restricted enough.

## Do in this phase

1. Add `quote_shares`, `quote_comments`, and `negotiation_requests` schema/
   repositories with tenant/contact/version references, expiry/revocation,
   visibility, state, audit/outbox support.
2. Implement authenticated internal share/revoke flow. Share only an internally
   approved version; validate contact/customer/tenant, expiry, and safe status;
   queue console/Resend invitation through adapter.
3. Implement portal list/detail DTOs. Query requires both active portal session
   and active share/customer relationship. Exclude margin/cost/internal risk/
   internal comments/staff details in serialization and tests.
4. Implement idempotent portal comment and negotiation-request commands. Store
   requested changes JSON against base immutable version; no quote/line/total
   mutation. Add rep list and resolve commands: decline, clarification, or
   `acceptAsRevision` creating editable revision for normal resubmission.
5. Implement idempotent portal acceptance of exact shared version. Verify share
   not expired/revoked, quote/version/status valid, record acceptance/audit/
   outbox. Transition to required reapproval or `readyForOrder`; do not convert
   order in this phase.
6. Add complete security/contract/e2e fixture tests and OpenAPI update.

## Do not do in this phase

- Do not expose generic customer route access, customer list/search, standard
  cost/margin/internal audit, or any unshared quote/order.
- Do not let counteroffer change commercial terms in place or bypass approval.
- Do not implement order conversion, allocation, billing, full email template
  designer, public attachments, or e-signature.

## Validation

- Customer contact sees own active shared quote only; sibling customer/contact,
  revoked/expired share, wrong tenant, or internal token fails safely.
- Contract tests prove portal DTO never has forbidden internal properties.
- Proposal leaves base quote/version/totals unchanged; rep acceptance creates
  revision and follows Phase 05 submission path.
- Acceptance exact-version/idempotency/reapproval/ready-order statuses are tested.

## Definition of done

- Portal is a real restricted API surface, not an internal route with a label.
- Negotiation and acceptance retain immutable commercial evidence and cannot
  bypass governance.
- All portal access/serialization/state rules are covered by tests.

## Frontend handoff

Frontend can build customer portal login, shared quote screen, comments,
proposal, acceptance, and reps' proposal-resolution UI. Use only portal paths
and portal-safe DTOs in `docs/FRONTEND_API.md`.
