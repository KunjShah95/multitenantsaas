# Phase 03 — Catalogue, pricing, governance, warehouse, and plan configuration

**Status:** Planned  
**Depends on:** Phase 02 complete  
**Owner gate:** None beyond working Neon environment

## Required reading

- [README.md](README.md)
- [../docs/03-backend-architecture.md](../docs/03-backend-architecture.md)
- [../docs/05-database-design.md](../docs/05-database-design.md)
- [../docs/06-domain-workflows.md](../docs/06-domain-workflows.md) — pricing/risk only
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md) — configuration only

## Already done

- Prototype has broad product/variant/price list/tier/category ceiling/approval
  chain/warehouse/plan/upsell CRUD in `modules/catalog.js`.
- Phase 01 has tenant/customer identity tables; Phase 02 has v1 auth/RBAC.
- No tenant-safe normalized commercial configuration schema or v1 configuration
  endpoint exists.

## Do in this phase

1. Add migrations/schemas/repositories for customer tiers, product categories,
   products, variants, price lists/items, discount policies/tier/category limits,
   approval policies/ordered steps, warehouses, inventory balances (metadata and
   opening balance only), subscription plans, upsell rules, teams/memberships
   additions if needed.
2. Implement v1 customer/customer-contact, product/category/variant, price-list,
   tier, discount-policy, approval-policy, warehouse, inventory-balance read +
   adjustment, plan, upsell-rule, team/membership configuration endpoints from
   frontend doc. Enforce role permissions and tenant context on every query.
3. Implement archive semantics, unique tenant SKU/name/code rules, safe bulk
   price-list item replacement, effective dates/priorities, percentage/plan
   validation, and audit events for configuration changes.
4. Implement draft/publish workflow for discount/approval policies. Publishing
   validates valid percentages, category/tier references, ordered approval
   sequence, effective dates, and enabled state. Published policy cannot be
   mutated; new edit is a new draft version.
5. Implement reusable server price resolution function with variant/tier/currency/
   effective date/priority inputs and unit tests. It returns decision/source,
   not client-controlled price.
6. Add idempotent fake demo data for two tenants and configuration integration/
   contract tests. Update OpenAPI and `FRONTEND_API.md` only if actual shapes
   differ from documented contract.

## Do not do in this phase

- Do not create quotes, calculate quote totals/risk, create approval records,
  reserve stock, or issue invoice/subscription records.
- Do not add supplier procurement/replenishment, price import UI, multi-company
  accounting, or external currency/FX service.
- Do not hard-delete referenced configurations or expose standard cost to portal.
- Do not implement a generic arbitrary “config CRUD” endpoint.

## Validation

- Test tenant isolation and role restrictions for every mutable configuration.
- Test invalid price date overlap/priority, missing variant, duplicate SKU/code,
  invalid percentage/approval steps, archived dependency, and published policy
  mutation failure.
- Test price resolver for exact tier/currency/variant rule, fallback rule, and
  no applicable rule; assert decimal precision.
- Run migration/seed twice, contract tests, OpenAPI validation, lint/typecheck.

## Definition of done

- An admin can configure complete tenant customer/catalogue/pricing/governance/
  warehouse/plan/upsell data through secure v1 APIs.
- Published commercial policies are versioned/immutable and price resolver is
  tested independently of controllers.
- All configuration mutations are audited and tenant-safe; no quote/order logic
  or new external service was added.

## Frontend handoff

Frontend can build backend configuration screens using configuration endpoints
in `docs/FRONTEND_API.md`. It must use archive/publish states and server field
errors rather than optimistic local policy calculations.
