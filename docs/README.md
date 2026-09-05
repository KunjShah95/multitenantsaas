# DealFlow360 documentation index

This folder is the authoritative backend/database design. Read only the files
needed for the task; do not load every document into an agent context by
default.

| File | Read it when you need to… |
| --- | --- |
| [00-owner-setup.md](00-owner-setup.md) | Prepare accounts, Neon, `.env`, and phase-owner inputs. |
| [01-scope-and-baseline.md](01-scope-and-baseline.md) | Understand the product boundary, current proof of concept, non-goals, and terms. |
| [02-technology-decisions.md](02-technology-decisions.md) | Select the approved free/open-source stack, cloud services, packages, and migration conventions. |
| [03-backend-architecture.md](03-backend-architecture.md) | Add server code, domain services, routes, error handling, or engineering standards. |
| [04-tenancy-auth-security.md](04-tenancy-auth-security.md) | Work on organizations, identity, permissions, portal access, RLS, or security. |
| [05-database-design.md](05-database-design.md) | Create migrations, schema, indexes, persistence, money handling, or data lifecycle rules. |
| [06-domain-workflows.md](06-domain-workflows.md) | Implement quotes, discounts, approvals, portal negotiation, inventory, subscriptions, billing, or health. |
| [FRONTEND_API.md](FRONTEND_API.md) | Build the frontend or publish the versioned API/OpenAPI contract. This is the frontend handoff. |
| [08-testing-operations.md](08-testing-operations.md) | Add tests, jobs, observability, deployment, CI, backups, or release checks. |

The implementation sequence is outside this folder. Start from
[../plans/PHASES.md](../plans/PHASES.md), then open only the docs referenced by
the selected phase.

## Source-of-truth rules

1. `docs/` describes the desired system; `plans/` describes executable work.
2. A versioned OpenAPI document generated from server schemas becomes the
   machine-readable API source of truth. Until it exists, `FRONTEND_API.md` is
   the frontend contract.
3. Existing root files such as `ARCHITECTURE.md` describe the proof of concept.
   They are historical context, not authority for new production code.
4. When implementation changes a design decision, update the smallest relevant
   document and affected phase handoff in the same pull request.
