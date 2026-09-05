# Phase 04 — Versioned quote builder, pricing, totals, margin, and suggestions

**Status:** Planned  
**Depends on:** Phase 03 complete  
**Owner gate:** None

## Required reading

- [README.md](README.md)
- [../docs/03-backend-architecture.md](../docs/03-backend-architecture.md)
- [../docs/05-database-design.md](../docs/05-database-design.md) — quote data
- [../docs/06-domain-workflows.md](../docs/06-domain-workflows.md) — price/tax only
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md) — quote builder only

## Already done

- Prototype can create/list/get quote, add/patch lines, compute totals/margin,
  and return simple rule-based suggestions using in-memory objects.
- Phase 03 supplies persisted tenant catalogue/pricing/upsell configuration and
  the tested price resolver.
- No persisted quote aggregate/version/line schema or v1 quote endpoints exist.

## Do in this phase

1. Add quote/quote-line/quote-version migrations and repositories. Current quote
   has customer/owner/currency/status/revision/display totals; editable line
   snapshots product name/SKU/category/unit/cost/price/tax/billing details;
   version is append-only commercial evidence.
2. Implement shared money/tax/rounding and margin functions as pure typed code.
   Document exact rounding tests. Do not use JS Number for decisions.
3. Implement v1 quote list/create/detail/patch, add/patch/delete line, and
   recommendations endpoints. Apply tenant + role + owner/team authorization,
   cursor/filter rules, Zod strict input, error envelope, and `If-Match`.
4. Line command accepts only product/variant/quantity/discount/billing intent/
   plan ID. Server resolves price/tax/cost snapshot and returns recalculated
   quote/totals/permitted profitability/risk-preview/recommendations.
5. Implement optimistic revisions with atomic increment. On stale edit return
   `409 VERSION_CONFLICT` including current revision; never silently merge.
6. Implement rule-based recommendation ranking from persisted upsell rules,
   filtering by availability/active product/minimum margin and excluding cart.
7. Write audit events for quote and line changes, generated OpenAPI schemas,
   fixtures, and unit/integration/contract tests.

## Do not do in this phase

- Do not submit quote/create approval steps, share portal quote, convert order,
  reserve inventory, or create subscription/invoice/payment records.
- Do not expose cost/margin to portal; portal APIs do not exist yet.
- Do not allow arbitrary unit price/tax/total/risk/state values from client.
- Do not copy all current quote routes unchanged or mutate product records.

## Validation

- Test price list/variant/tier/currency snapshot stays fixed after configuration
  change; test money/tax/margin precision and totals.
- Test line mutation authorization, malformed/unknown product/variant, and
  archived/unavailable config cases.
- Test two edits with same revision: one succeeds, one gets exact `409`.
- Test list filters/cursor, recommendations ranking, audit row, API DTO and
  tenant isolation using real Neon.

## Definition of done

- Secure v1 quote builder persists version-ready quote/line snapshots and all
  server calculations return one consistent read model.
- Quotes are editable drafts only, tenant/owner-safe, audited, idempotently
  created, revision-protected, and documented in OpenAPI.
- No approval, portal, order, stock, or billing behavior has been added.

## Frontend handoff

Frontend can build quote list and builder. Use returned totals/margin/risk/
suggestions/actions; include `If-Match`; reload on 409. See exact requests in
`docs/FRONTEND_API.md`.
