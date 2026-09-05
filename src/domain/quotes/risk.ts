import { eq, and } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import * as schema from "../../db/schema/index.js";
import { parseMoney, formatMoney } from "../../shared/money.js";

export type RiskLine = {
  discountPct: string;
  subtotal: string;
  allowedPct: string;
};

export type RiskPreview = {
  score: string;
  level: string;
  lineDetails: Array<{ discountPct: string; allowedPct: string; overage: string }>;
};

/**
 * Resolve allowed discount per line from published discount policies.
 * allowed = min(tierCeiling, categoryCeiling) where ceiling missing = 100.
 * Fetches the most recent published policy effective now.
 */
export async function resolveAllowedDiscount(
  tx: Db,
  tenantId: string,
  tierCode: string | null | undefined,
  categoryCode: string | null | undefined,
): Promise<string> {
  const now = new Date();

  const policies = await tx
    .select()
    .from(schema.discountPolicies)
    .where(and(eq(schema.discountPolicies.tenantId, tenantId), eq(schema.discountPolicies.status, "published")));

  // Filter effective window
  const effective = policies.filter((p) => {
    const fromOk = !p.effectiveFrom || new Date(p.effectiveFrom) <= now;
    const toOk = !p.effectiveTo || new Date(p.effectiveTo) > now;
    return fromOk && toOk && !p.archivedAt;
  });

  if (effective.length === 0) return "100.00";

  // Sort by most recent publishedAt then createdAt
  effective.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : new Date(a.createdAt).getTime();
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  const policy = effective[0]!;
  const tierLimits = await tx
    .select()
    .from(schema.discountTierLimits)
    .where(eq(schema.discountTierLimits.policyId, policy.id));
  const catLimits = await tx
    .select()
    .from(schema.discountCategoryLimits)
    .where(eq(schema.discountCategoryLimits.policyId, policy.id));

  let tierCeiling: number | null = null;
  if (tierCode) {
    const found = tierLimits.find((t) => t.tierCode === tierCode);
    if (found) tierCeiling = Number(found.ceilingPct);
  }
  let catCeiling: number | null = null;
  if (categoryCode) {
    const found = catLimits.find((c) => c.categoryCode === categoryCode);
    if (found) catCeiling = Number(found.ceilingPct);
  }

  const ceilings: number[] = [];
  if (tierCeiling !== null) ceilings.push(tierCeiling);
  if (catCeiling !== null) ceilings.push(catCeiling);
  if (ceilings.length === 0) return "100.00";
  const allowed = Math.min(...ceilings);
  return allowed.toFixed(2);
}

export async function computeRiskPreview(
  tx: Db,
  tenantId: string,
  lines: Array<{
    discountPct: string;
    subtotal: string;
    productCategoryCode: string | null;
  }>,
  customerTierCode: string | null | undefined,
): Promise<RiskPreview> {
  const details: Array<{ discountPct: string; allowedPct: string; overage: string }> = [];
  let weightedSum = 0;
  let maxOverage = 0;
  let grossTotal = 0;
  for (const l of lines) grossTotal += Number(l.subtotal);

  const allowedList: string[] = [];
  for (const l of lines) {
    const allowed = await resolveAllowedDiscount(tx, tenantId, customerTierCode ?? null, l.productCategoryCode);
    allowedList.push(allowed);
    const over = Math.max(0, Number(l.discountPct) - Number(allowed));
    details.push({ discountPct: l.discountPct, allowedPct: allowed, overage: over.toFixed(2) });
    if (over > maxOverage) maxOverage = over;
  }

  // weighted
  for (let i = 0; i < lines.length; i++) {
    const over = Number(details[i]!.overage);
    const lineGross = Number(lines[i]!.subtotal);
    if (grossTotal > 0) weightedSum += (over * lineGross) / grossTotal;
  }

  const score = weightedSum + 0.5 * maxOverage;
  let level = "none";
  if (score === 0) level = "none";
  else if (score <= 5) level = "manager";
  else level = "finance";

  return { score: score.toFixed(6), level, lineDetails: details };
}
