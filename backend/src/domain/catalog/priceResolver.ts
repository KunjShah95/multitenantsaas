import type { Db } from "../../db/connection.js";
import { priceLists, priceListItems } from "../../db/schema/index.js";
import { and, eq, isNull, or, desc, sql } from "drizzle-orm";

/**
 * Reusable server price resolution — returns decision/source, not client price.
 * Inputs are all tenant-scoped and validated before DB access.
 * Uses numeric(20,6) decimal strings for precision — caller compares as strings or converts via Decimal if needed.
 *
 * Resolution order (per docs/05-database-design.md & 06-domain-workflows):
 * 1. Tenant + currency + productId + variantId (nullable) must match
 * 2. Effective date must be within [effectiveFrom, effectiveTo) — null bounds mean unbounded
 * 3. Archived price_lists are excluded (status != archived handled by query, or archivedAt IS NULL)
 * 4. Priority: tier-specific list (customerTierId match) takes precedence over generic (null tier)
 *    then higher priority integer wins, then most recent effectiveFrom.
 * 5. Returns null if no applicable rule (caller falls back to product standardPrice).
 */

export type PriceResolveInput = {
  tenantId: string;
  productId: string;
  variantId?: string | null;
  currency: string;
  customerTierId?: string | null;
  effectiveDate?: Date;
  tx: Db;
};

export type PriceResolveResult = {
  price: string; // decimal string "1200.000000"
  source: "price_list" | "standard";
  priceListId?: string;
  priceListItemId?: string;
};

export async function resolvePrice(input: PriceResolveInput): Promise<PriceResolveResult | null> {
  const effectiveDate = input.effectiveDate ?? new Date();
  const currency = input.currency.toUpperCase();

  // Build base where: tenant + currency + date window
  // We will fetch candidate price lists that are applicable, then join items.
  // For correctness, do two-stage: find best list, then find item.

  // Candidate lists: tenant + currency, archivedAt IS NULL, status active, effective window contains effectiveDate
  const lists = await input.tx
    .select()
    .from(priceLists)
    .where(
      and(
        eq(priceLists.tenantId, input.tenantId),
        eq(priceLists.currency, currency),
        isNull(priceLists.archivedAt),
        or(
          isNull(priceLists.effectiveFrom),
          sql`${priceLists.effectiveFrom} <= ${effectiveDate.toISOString()}::timestamptz`,
        ),
        or(
          isNull(priceLists.effectiveTo),
          sql`${priceLists.effectiveTo} > ${effectiveDate.toISOString()}::timestamptz`,
        ),
      ),
    );

  if (lists.length === 0) return null;

  // Sort by precedence: tier match first, then priority desc, then effectiveFrom desc
  const tierId = input.customerTierId ?? null;
  lists.sort((a, b) => {
    const aTierMatch =
      tierId && a.customerTierId === tierId ? 1 : a.customerTierId === null ? 0 : -1;
    const bTierMatch =
      tierId && b.customerTierId === tierId ? 1 : b.customerTierId === null ? 0 : -1;
    if (aTierMatch !== bTierMatch) return bTierMatch - aTierMatch;
    if (a.priority !== b.priority) return b.priority - a.priority;
    const aFrom = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
    const bFrom = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
    return bFrom - aFrom;
  });

  // For each list in precedence order, check for an exact item match
  const variantId = input.variantId ?? null;
  for (const list of lists) {
    // Tier filtering: if list has tier, it must match requested tier; generic lists (null) are fallback
    // Already sorted, but enforce: skip tier-specific list that doesn't match requested tier unless requested tier is null and we allow generic only? Actually generic should be considered after all tier-specific, but tier-specific for different tier should not match.
    if (list.customerTierId !== null && list.customerTierId !== tierId) continue;

    const items = await input.tx
      .select()
      .from(priceListItems)
      .where(
        and(
          eq(priceListItems.tenantId, input.tenantId),
          eq(priceListItems.priceListId, list.id),
          eq(priceListItems.productId, input.productId),
          variantId ? eq(priceListItems.variantId, variantId) : isNull(priceListItems.variantId),
        ),
      )
      .limit(1);

    const item = items[0];
    if (item) {
      return {
        price: item.price,
        source: "price_list",
        priceListId: list.id,
        priceListItemId: item.id,
      };
    }

    // Fallback: if variant requested but list has product-level price (variantId null) consider it? Spec says exact tier/currency/variant rule, fallback rule.
    // If no exact variant match, try generic variant null as fallback within same list.
    if (variantId) {
      const fallback = await input.tx
        .select()
        .from(priceListItems)
        .where(
          and(
            eq(priceListItems.tenantId, input.tenantId),
            eq(priceListItems.priceListId, list.id),
            eq(priceListItems.productId, input.productId),
            isNull(priceListItems.variantId),
          ),
        )
        .limit(1);
      if (fallback[0]) {
        return {
          price: fallback[0].price,
          source: "price_list",
          priceListId: list.id,
          priceListItemId: fallback[0].id,
        };
      }
    }
  }

  return null;
}

/**
 * Validate decimal price string has at most 6 fractional digits and non-negative.
 */
export function validatePriceString(price: string): string | null {
  if (!/^\d+(\.\d{1,6})?$/.test(price))
    return "Price must be decimal with up to 6 fractional digits";
  const num = Number(price);
  if (Number.isNaN(num) || num < 0) return "Price must be non-negative";
  return null;
}

/**
 * Format numeric to 6-decimal string for API (money contract).
 */
export function toMoneyString(n: number | string): string {
  const num = typeof n === "string" ? Number(n) : n;
  return num.toFixed(6);
}
