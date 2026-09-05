import { eq, and } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import * as schema from "../../db/schema/index.js";
import { parseMoney, formatMoney } from "../../shared/money.js";
import { resolvePrice } from "../catalog/priceResolver.js";

export type RecommendationItem = {
  productId: string;
  productName: string;
  sku: string;
  categoryCode: string | null;
  unitPrice: string;
  marginDelta: string | null;
  score: number;
  weight: string;
  promoted: boolean;
};

/**
 * Rule-based recommendation ranking from persisted upsell_rules,
 * filtering by availability/active product/minimum margin and excluding cart.
 * Ranking: promoted first, then weight desc, then score.
 */
export async function getRecommendations(
  tx: Db,
  tenantId: string,
  quoteCurrency: string,
  customerTierId: string | null | undefined,
  cartProductIds: string[],
  cartVariantIds: (string | null)[],
  limit: number,
  // For margin filtering need current quote margin context? Use per-suggested product margin calc
  quoteNetTotal?: string,
): Promise<RecommendationItem[]> {
  // Fetch all upsell rules for tenant where trigger in cart
  if (cartProductIds.length === 0) return [];

  const allRules = await tx.select().from(schema.upsellRules).where(eq(schema.upsellRules.tenantId, tenantId));
  const cartSetForTrigger = new Set(cartProductIds);
  const rules = allRules.filter((r) => cartSetForTrigger.has(r.triggerProductId));

  // Filter out archived rules
  const activeRules = rules.filter((r) => !r.archivedAt);

  // Exclude where suggested already in cart
  const cartSet = new Set(cartProductIds);
  const filtered = activeRules.filter((r) => !cartSet.has(r.suggestedProductId));

  if (filtered.length === 0) return [];

  // For each rule, load suggested product and verify availability
  const results: RecommendationItem[] = [];
  for (const rule of filtered) {
    const prodRows = await tx
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.id, rule.suggestedProductId), eq(schema.products.tenantId, tenantId)))
      .limit(1);
    const product = prodRows[0];
    if (!product || product.archivedAt) continue;

    // Resolve price for suggested product (use standard or price list)
    const resolved = await resolvePrice({
      tenantId,
      productId: product.id,
      variantId: null,
      currency: quoteCurrency,
      customerTierId: customerTierId ?? null,
      effectiveDate: new Date(),
      tx: tx as any,
    });
    const unitPrice = resolved ? resolved.price : product.standardPrice;

    // Compute margin for suggested product (assuming qty 1, no discount)
    const unitCost = product.standardCost ?? "0";
    const priceBig = parseMoney(unitPrice);
    const costBig = parseMoney(unitCost);
    const marginBig = priceBig - costBig;
    const marginDelta = formatMoney(marginBig);

    // Minimum margin filtering
    if (rule.minMarginPct !== null && rule.minMarginPct !== undefined) {
      const minPct = Number(rule.minMarginPct);
      // marginPct = margin / price *100
      let marginPct = 0;
      if (priceBig !== 0n) {
        const absMargin = marginBig < 0n ? -marginBig : marginBig;
        const pctBig = (absMargin * 100n * 100n) / priceBig; // scale2
        marginPct = Number(pctBig) / 100;
        if (marginBig < 0n) marginPct = -marginPct;
      }
      if (marginPct < minPct) continue;
    }

    // Score: weight + promoted boost (promoted adds 10)
    const weightNum = Number(rule.weight ?? "1");
    const promotedBoost = rule.promoted ? 10 : 0;
    const score = weightNum + promotedBoost;

    let categoryCode: string | null = null;
    if (product.categoryId) {
      const cat = await tx
        .select()
        .from(schema.productCategories)
        .where(eq(schema.productCategories.id, product.categoryId))
        .limit(1);
      categoryCode = cat[0]?.code ?? null;
    }

    results.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      categoryCode,
      unitPrice,
      marginDelta,
      score,
      weight: rule.weight ?? "1",
      promoted: rule.promoted ?? false,
    });
  }

  // Rank: promoted first, then score desc, weight desc
  results.sort((a, b) => {
    if (a.promoted !== b.promoted) return a.promoted ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return Number(b.weight) - Number(a.weight);
  });

  return results.slice(0, limit);
}
