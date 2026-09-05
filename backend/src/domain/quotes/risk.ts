import { eq, and } from "drizzle-orm";
import type { Db } from "../../db/connection.js";
import * as schema from "../../db/schema/index.js";

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

// ---- Pure evaluator types ----

export type DiscountPolicySnapshot = {
  tierLimits: Array<{ tierCode: string; ceilingPct: string }>;
  categoryLimits: Array<{ categoryCode: string; ceilingPct: string }>;
};

export type ApprovalPolicySnapshot = {
  steps: Array<{ sequence: number; role: string; name?: string | null }>;
};

export type RiskInput = {
  lines: Array<{ discountPct: string; subtotal: string; categoryCode?: string | null }>;
  customerTierCode?: string | null;
  discountPolicy?: DiscountPolicySnapshot | null;
  approvalPolicy?: ApprovalPolicySnapshot | null;
  orderDiscountPct?: string | null;
  managerUpTo?: number; // threshold for manager route, default 5
};

export type RiskLineDetail = {
  requested: string;
  allowed: string;
  overage: string;
  categoryCode: string | null;
  subtotal: string;
};

export type RiskEvaluation = {
  lines: RiskLineDetail[];
  weightedOverage: string;
  maxOverage: string;
  grossTotal: string;
  orderDiscountPct: string | null;
  orderAllowedPct: string | null;
  orderOverage: string | null;
  score: string; // 6 decimals
  level: "none" | "manager" | "finance";
  reasonCodes: string[];
  requiredSteps: Array<{ sequence: number; role: string }>;
  tierCeiling: string | null;
};

function toNumberPct(s: string): number {
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Invalid pct ${s}`);
  return n;
}

function resolveAllowedPure(
  customerTierCode: string | null | undefined,
  categoryCode: string | null | undefined,
  discountPolicy: DiscountPolicySnapshot | null | undefined,
): string {
  if (!discountPolicy) return "100.00";
  let tierCeiling: number | null = null;
  if (customerTierCode) {
    const found = discountPolicy.tierLimits.find((t) => t.tierCode === customerTierCode);
    if (found) tierCeiling = toNumberPct(found.ceilingPct);
  }
  let catCeiling: number | null = null;
  if (categoryCode) {
    const found = discountPolicy.categoryLimits.find((c) => c.categoryCode === categoryCode);
    if (found) catCeiling = toNumberPct(found.ceilingPct);
  }
  const ceilings: number[] = [];
  if (tierCeiling !== null) ceilings.push(tierCeiling);
  if (catCeiling !== null) ceilings.push(catCeiling);
  if (ceilings.length === 0) return "100.00";
  return Math.min(...ceilings).toFixed(2);
}

function resolveTierCeilingPure(
  customerTierCode: string | null | undefined,
  discountPolicy: DiscountPolicySnapshot | null | undefined,
): number | null {
  if (!discountPolicy || !customerTierCode) return null;
  const found = discountPolicy.tierLimits.find((t) => t.tierCode === customerTierCode);
  return found ? toNumberPct(found.ceilingPct) : null;
}

/**
 * Pure risk evaluator — no DB, explicit policy inputs, detailed explainable output.
 * Implements spec formula: riskScore = weightedOverage + 0.5*maxOverage + orderExcessPenalty
 * Routing (initial thresholds, overridable via managerUpTo):
 *  score ==0 => none (auto-approve)
 *  0 < score <= managerUpTo => manager (unless forced finance by overage/order triggers)
 *  score > managerUpTo OR maxOverage >=8 OR orderDiscount > tierCeiling+10 => manager+finance
 */
export function evaluateRisk(input: RiskInput): RiskEvaluation {
  const managerUpTo = input.managerUpTo ?? 5;
  const discountPolicy = input.discountPolicy ?? null;

  const tierCeilingNum = resolveTierCeilingPure(input.customerTierCode ?? null, discountPolicy);
  const tierCeilingStr = tierCeilingNum !== null ? tierCeilingNum.toFixed(2) : null;

  const lineDetails: RiskLineDetail[] = [];
  let maxOverage = 0;
  let grossTotal = 0;
  for (const l of input.lines) grossTotal += Number(l.subtotal);

  for (const l of input.lines) {
    const allowed = resolveAllowedPure(
      input.customerTierCode ?? null,
      l.categoryCode ?? null,
      discountPolicy,
    );
    const over = Math.max(0, toNumberPct(l.discountPct) - toNumberPct(allowed));
    if (over > maxOverage) maxOverage = over;
    lineDetails.push({
      requested: Number(l.discountPct).toFixed(2),
      allowed,
      overage: over.toFixed(2),
      categoryCode: l.categoryCode ?? null,
      subtotal: l.subtotal,
    });
  }

  let weightedOverage = 0;
  for (let i = 0; i < input.lines.length; i++) {
    const over = Number(lineDetails[i]!.overage);
    const gross = Number(input.lines[i]!.subtotal);
    if (grossTotal > 0) weightedOverage += (over * gross) / grossTotal;
  }

  // order discount handling
  let orderDiscountPct: string | null = null;
  let orderAllowedPct: string | null = null;
  let orderOverageNum = 0;
  let orderOverage: string | null = null;
  if (input.orderDiscountPct != null) {
    orderDiscountPct = Number(input.orderDiscountPct).toFixed(2);
    if (tierCeilingNum !== null) {
      orderAllowedPct = tierCeilingNum.toFixed(2);
      orderOverageNum = Math.max(0, Number(orderDiscountPct) - tierCeilingNum);
      orderOverage = orderOverageNum.toFixed(2);
    } else {
      orderAllowedPct = null;
      orderOverage = null;
    }
  }

  const orderExcessPenalty = orderOverageNum > 2 ? (orderOverageNum - 2) * 0.5 : 0;

  const rawScore = weightedOverage + 0.5 * maxOverage + orderExcessPenalty;
  const score = Math.round(rawScore * 100) / 100; // prototype rounds to 2 decimals for decision

  const reasonCodes: string[] = [];
  if (input.lines.length === 0) reasonCodes.push("EMPTY_QUOTE");
  if (score === 0 && input.lines.length > 0) reasonCodes.push("NO_OVERAGE");
  if (weightedOverage > 0) reasonCodes.push("WEIGHTED_OVERAGE");
  if (maxOverage > 0) reasonCodes.push("MAX_OVERAGE");
  if (maxOverage >= 8) reasonCodes.push("LINE_OVERAGE_GTE_8");
  if (orderOverageNum > 0) reasonCodes.push("ORDER_OVERAGE");
  if (orderOverageNum > 10) reasonCodes.push("ORDER_DISCOUNT_GTE_TIER_PLUS_10");
  if (orderExcessPenalty > 0) reasonCodes.push("ORDER_EXCESS_PENALTY");
  if (score > 0 && score <= managerUpTo) reasonCodes.push("SCORE_WITHIN_MANAGER_THRESHOLD");
  if (score > managerUpTo) reasonCodes.push("SCORE_ABOVE_MANAGER_THRESHOLD");

  let level: "none" | "manager" | "finance" = "none";
  if (score === 0 && maxOverage === 0 && orderOverageNum <= 10) {
    // empty or no overage => none, even if order overage small? But order big triggers finance
    if (orderOverageNum > 10) level = "finance";
    else level = "none";
  } else if (score > managerUpTo || maxOverage >= 8 || orderOverageNum > 10) {
    level = "finance";
  } else if (score > 0 || orderOverageNum > 0) {
    level = "manager";
  } else {
    level = "none";
  }

  // required ordered steps — use approvalPolicy snapshot if provided, else fallback to manager/finance defaults
  let requiredSteps: Array<{ sequence: number; role: string }> = [];
  if (level === "none") {
    requiredSteps = [];
  } else if (level === "manager") {
    if (input.approvalPolicy?.steps?.length) {
      const first = [...input.approvalPolicy.steps].sort((a, b) => a.sequence - b.sequence)[0]!;
      requiredSteps = [{ sequence: 1, role: first.role }];
    } else {
      requiredSteps = [{ sequence: 1, role: "manager" }];
    }
  } else {
    // finance => need manager then finance
    if (input.approvalPolicy?.steps?.length) {
      requiredSteps = [...input.approvalPolicy.steps]
        .sort((a, b) => a.sequence - b.sequence)
        .map((s, idx) => ({ sequence: idx + 1, role: s.role }));
      // if policy has only one step but finance required, keep as is; exhaustive list
      if (requiredSteps.length === 1) {
        // ensure at least manager->finance if policy incomplete
        if (requiredSteps[0]!.role !== "manager")
          requiredSteps = [
            { sequence: 1, role: "manager" },
            { sequence: 2, role: "finance" },
          ];
        else
          requiredSteps = [
            { sequence: 1, role: "manager" },
            { sequence: 2, role: "finance" },
          ];
      }
    } else {
      requiredSteps = [
        { sequence: 1, role: "manager" },
        { sequence: 2, role: "finance" },
      ];
    }
  }

  return {
    lines: lineDetails,
    weightedOverage: weightedOverage.toFixed(6),
    maxOverage: maxOverage.toFixed(2),
    grossTotal: grossTotal.toFixed(6),
    orderDiscountPct,
    orderAllowedPct,
    orderOverage,
    score: score.toFixed(6),
    level,
    reasonCodes,
    requiredSteps,
    tierCeiling: tierCeilingStr,
  };
}

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
    .where(
      and(
        eq(schema.discountPolicies.tenantId, tenantId),
        eq(schema.discountPolicies.status, "published"),
      ),
    );

  // Filter effective window
  const effective = policies.filter((p) => {
    const fromOk = !p.effectiveFrom || new Date(p.effectiveFrom) <= now;
    const toOk = !p.effectiveTo || new Date(p.effectiveTo) > now;
    return fromOk && toOk && !p.archivedAt;
  });

  if (effective.length === 0) return "100.00";

  // Sort by most recent publishedAt then createdAt
  effective.sort((a, b) => {
    const aTime = a.publishedAt
      ? new Date(a.publishedAt).getTime()
      : new Date(a.createdAt).getTime();
    const bTime = b.publishedAt
      ? new Date(b.publishedAt).getTime()
      : new Date(b.createdAt).getTime();
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
    const allowed = await resolveAllowedDiscount(
      tx,
      tenantId,
      customerTierCode ?? null,
      l.productCategoryCode,
    );
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
