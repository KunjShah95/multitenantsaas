import { calcLine, parseMoney, formatMoney } from "../../shared/money.js";

export type SubscriptionTerms = {
  quantity: string;
  unitPrice: string;
  discountPct: string;
  taxRatePct: string;
};

export type PeriodAmount = {
  net: string;
  tax: string;
  total: string;
};

export function computePeriodAmount(terms: SubscriptionTerms): PeriodAmount {
  const line = calcLine({
    quantity: terms.quantity,
    unitPrice: terms.unitPrice,
    discountPct: terms.discountPct,
    taxRatePct: terms.taxRatePct,
    unitCost: "0",
  });
  return { net: line.net, tax: line.tax, total: line.total };
}

export type ProrationResult = {
  netDelta: string;
  taxDelta: string;
  totalDelta: string;
  direction: "credit" | "debit" | "none";
  remainingFraction: string;
};

function divRoundHalfUp(numer: bigint, denom: bigint): bigint {
  if (denom <= 0n) throw new Error("denom must be >0");
  const half = denom / 2n;
  return (numer + half) / denom;
}

function applyFraction(amount: string, fractionMicro: bigint): string {
  const amt = parseMoney(amount);
  const product = amt * fractionMicro;
  const result = divRoundHalfUp(product, 1_000_000n);
  return formatMoney(result);
}

/**
 * Prorate remaining period from effectiveAt to periodEnd.
 * Delta = newRemaining - oldRemaining (positive => customer owes debit).
 */
export function computeProration(
  oldTerms: SubscriptionTerms,
  newTerms: SubscriptionTerms,
  periodStart: Date,
  periodEnd: Date,
  effectiveAt: Date,
): ProrationResult {
  const periodMs = periodEnd.getTime() - periodStart.getTime();
  if (periodMs <= 0) throw new Error("Invalid billing period");

  if (effectiveAt.getTime() < periodStart.getTime()) {
    throw new Error("Effective date is before current period start");
  }
  if (effectiveAt.getTime() >= periodEnd.getTime()) {
    throw new Error("Effective date is at or after current period end");
  }

  const remainingMs = periodEnd.getTime() - effectiveAt.getTime();
  const fractionMicro = BigInt(Math.round((remainingMs / periodMs) * 1_000_000));
  const remainingFraction = (Number(fractionMicro) / 1_000_000).toFixed(6);

  const oldAmt = computePeriodAmount(oldTerms);
  const newAmt = computePeriodAmount(newTerms);

  const oldRemainingNet = applyFraction(oldAmt.net, fractionMicro);
  const oldRemainingTax = applyFraction(oldAmt.tax, fractionMicro);
  const oldRemainingTotal = applyFraction(oldAmt.total, fractionMicro);

  const newRemainingNet = applyFraction(newAmt.net, fractionMicro);
  const newRemainingTax = applyFraction(newAmt.tax, fractionMicro);
  const newRemainingTotal = applyFraction(newAmt.total, fractionMicro);

  const netDeltaBig = parseMoney(newRemainingNet) - parseMoney(oldRemainingNet);
  const taxDeltaBig = parseMoney(newRemainingTax) - parseMoney(oldRemainingTax);
  const totalDeltaBig = parseMoney(newRemainingTotal) - parseMoney(oldRemainingTotal);

  let direction: ProrationResult["direction"] = "none";
  if (totalDeltaBig > 0n) direction = "debit";
  else if (totalDeltaBig < 0n) direction = "credit";

  return {
    netDelta: formatMoney(netDeltaBig < 0n ? -netDeltaBig : netDeltaBig),
    taxDelta: formatMoney(taxDeltaBig < 0n ? -taxDeltaBig : taxDeltaBig),
    totalDelta: formatMoney(totalDeltaBig < 0n ? -totalDeltaBig : totalDeltaBig),
    direction,
    remainingFraction,
  };
}

export type CancelCreditResult = {
  creditNet: string;
  creditTax: string;
  creditTotal: string;
  direction: "credit" | "none";
  remainingFraction: string;
};

/**
 * Cancellation credit for unused portion per cancel policy.
 */
export function computeCancellationCredit(
  terms: SubscriptionTerms,
  cancelPolicy: "credit_remaining" | "no_refund" | "charge_remaining",
  periodStart: Date,
  periodEnd: Date,
  effectiveAt: Date,
): CancelCreditResult {
  if (cancelPolicy === "no_refund") {
    return {
      creditNet: "0.000000",
      creditTax: "0.000000",
      creditTotal: "0.000000",
      direction: "none",
      remainingFraction: "0.000000",
    };
  }

  const periodMs = periodEnd.getTime() - periodStart.getTime();
  if (periodMs <= 0) throw new Error("Invalid billing period");

  const clampedEffective = Math.max(periodStart.getTime(), Math.min(effectiveAt.getTime(), periodEnd.getTime()));
  const remainingMs = periodEnd.getTime() - clampedEffective;
  const fractionMicro = BigInt(Math.round((remainingMs / periodMs) * 1_000_000));
  const remainingFraction = (Number(fractionMicro) / 1_000_000).toFixed(6);

  const amt = computePeriodAmount(terms);
  const creditNet = applyFraction(amt.net, fractionMicro);
  const creditTax = applyFraction(amt.tax, fractionMicro);
  const creditTotal = applyFraction(amt.total, fractionMicro);

  return {
    creditNet,
    creditTax,
    creditTotal,
    direction: creditTotal === "0.000000" ? "none" : "credit",
    remainingFraction,
  };
}

/** Signed delta helpers for storage — store absolute amount + type on adjustment. */
export function signedTotalDelta(direction: ProrationResult["direction"], totalDelta: string): string {
  if (direction === "debit") return totalDelta;
  if (direction === "credit") return `-${totalDelta}`;
  return "0.000000";
}
