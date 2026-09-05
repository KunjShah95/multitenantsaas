# DealFlow360 phase index

Each phase is intentionally small enough for one focused agent run. Do phases
in order unless this file explicitly states otherwise. “Planned” means no agent
has completed it yet; its phase file records the present baseline so future
agents do not need to infer it.

| Phase | Status | Outcome | Start command |
| --- | --- | --- | --- |
| [00](phase-00-owner-and-foundation.md) | Planned | Owner cloud/env setup and safe engineering foundation | `Start Phase 00 from plans/phase-00-owner-and-foundation.md` |
| [01](phase-01-neon-tenancy-data.md) | Planned | Neon/Drizzle persistence, tenant identity core, RLS, audit/outbox/idempotency | `Start Phase 01 from plans/phase-01-neon-tenancy-data.md` |
| [02](phase-02-auth-and-authorization.md) | Planned | Secure sessions, memberships, RBAC, invitations, portal identity | `Start Phase 02 from plans/phase-02-auth-and-authorization.md` |
| [03](phase-03-catalog-and-governance.md) | Planned | Customer/catalogue/pricing/governance/warehouse configuration | `Start Phase 03 from plans/phase-03-catalog-and-governance.md` |
| [04](phase-04-quotes.md) | Planned | Versioned quote builder, pricing/totals/margin/recommendations | `Start Phase 04 from plans/phase-04-quotes.md` |
| [05](phase-05-approvals.md) | Planned | Risk evaluation, frozen policy approval workflow, internal audit/inbox | `Start Phase 05 from plans/phase-05-approvals.md` |
| [06](phase-06-customer-portal.md) | Planned | Restricted portal share, comment, negotiation, acceptance | `Start Phase 06 from plans/phase-06-customer-portal.md` |
| [07](phase-07-orders-and-inventory.md) | Planned | Order conversion, stock ledger/reservation, allocations and shipment | `Start Phase 07 from plans/phase-07-orders-and-inventory.md` |
| [08](phase-08-subscriptions-and-billing.md) | Complete | Subscription changes, proration, invoices, payment boundary/jobs | `Start Phase 08 from plans/phase-08-subscriptions-and-billing.md` |
| [09](phase-09-health-reports-and-events.md) | Complete | Health alerts, reports/exports, notification worker, SSE | `Start Phase 09 from plans/phase-09-health-reports-and-events.md` |
| [10](phase-10-release-hardening.md) | Planned | Security/performance/operations/release readiness | `Start Phase 10 from plans/phase-10-release-hardening.md` |

Before starting any phase, apply the protocol in [README.md](README.md). The
frontend should use [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md), not the
phase files, as its API guide.
