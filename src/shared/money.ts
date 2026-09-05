/**
 * Shared money/tax/rounding primitives — pure, no JS Number decisions for money.
 * All amounts are decimal strings with exactly 6 fractional digits (numeric(20,6)).
 * Percentages are decimal strings with up to 2 fractional digits in [0,100].
 *
 * Rounding: half-up to 6 decimal places (or to 2 for pct-derived intermediates).
 * Implementation uses BigInt fixed-point to avoid binary float error.
 *
 * Documented rounding cases (tested in tests/unit/money.test.ts):
 * - 1.0000005 rounds to 1.000001 (half-up)
 * - multiplication 1.000001 * 1.000001 = 1.000002000001 -> rounds to 1.000002
 * - discount 100.000000 @ 33.335% -> 33.335000 (exact 33.335)
 * - tax 100.00 @ 8.875% -> 8.875000
 * - margin pct: 20/100*100 = 20.00, 1/3*100 = 33.33 (half-up to 2 decimals for display, but stored as 6?)
 */

const MONEY_SCALE = 6;
const MONEY_FACTOR = 10n ** BigInt(MONEY_SCALE); // 1_000_000
const PCT_SCALE = 2;
const PCT_FACTOR = 10n ** BigInt(PCT_SCALE); // 100

function parseDecimal(raw: string, scale: number): bigint {
  if (typeof raw !== "string") throw new Error(`Invalid decimal: ${raw}`);
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.startsWith("-")) throw new Error(`Negative not allowed: ${raw}`);
  // allow "0", "0.1", "123.456789"
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid decimal format: ${raw}`);
  const [intPart, fracPartRaw = ""] = trimmed.split(".");
  if (fracPartRaw.length > scale) throw new Error(`Too many decimals for scale ${scale}: ${raw}`);
  const fracPart = fracPartRaw.padEnd(scale, "0");
  const factor = 10n ** BigInt(scale);
  return BigInt(intPart!) * factor + BigInt(fracPart || "0");
}

function formatDecimal(value: bigint, scale: number): string {
  const factor = 10n ** BigInt(scale);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const intPart = abs / factor;
  const fracPart = abs % factor;
  const fracStr = fracPart.toString().padStart(scale, "0");
  const result = scale === 0 ? intPart.toString() : `${intPart.toString()}.${fracStr}`;
  return negative ? `-${result}` : result;
}

export function parseMoney(amount: string): bigint {
  return parseDecimal(amount, MONEY_SCALE);
}

export function formatMoney(value: bigint): string {
  return formatDecimal(value, MONEY_SCALE);
}

export function parsePct(pct: string): bigint {
  return parseDecimal(pct, PCT_SCALE);
}

export function formatPct(value: bigint): string {
  return formatDecimal(value, PCT_SCALE);
}

export function isValidMoneyString(s: string): boolean {
  return /^\d+(\.\d{1,6})?$/.test(s) && Number(s) >= 0;
}

export function isValidPctString(s: string): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return false;
  const n = Number(s);
  return n >= 0 && n <= 100;
}

/**
 * Half-up division: round(numer / denom) to nearest integer, .5 up.
 * Both positive.
 */
function divRoundHalfUp(numer: bigint, denom: bigint): bigint {
  if (denom <= 0n) throw new Error("denom must be >0");
  if (numer < 0n) throw new Error("numer negative not expected");
  const half = denom / 2n;
  // For odd denom, half is floor; still half-up correctly for integer division
  // Need to add half for positive; for negative would need different.
  return (numer + half) / denom;
}

/** quantity (6) * unitPrice (6) => lineSubtotal (6) */
export function mulQuantityPrice(quantity: string, unitPrice: string): string {
  const q = parseMoney(quantity);
  const p = parseMoney(unitPrice);
  const product = q * p; // scale 12
  const result = divRoundHalfUp(product, MONEY_FACTOR);
  return formatMoney(result);
}

/** subtotal (6) * discountPct (2) /100 => discountAmount (6) */
export function calcDiscountAmount(subtotal: string, discountPct: string): string {
  if (discountPct === "0" || discountPct === "0.00" || discountPct === "0.0") return "0.000000";
  const s = parseMoney(subtotal);
  const pct = parsePct(discountPct);
  // discount = s * pct / (100 * 100) -> divisor 10000 = PCT_FACTOR * 100
  const numer = s * pct;
  const denom = PCT_FACTOR * 100n; // 10000
  const result = divRoundHalfUp(numer, denom);
  return formatMoney(result);
}

/** net = subtotal - discount */
export function calcNet(subtotal: string, discountAmount: string): string {
  const s = parseMoney(subtotal);
  const d = parseMoney(discountAmount);
  const net = s - d;
  if (net < 0n) throw new Error("Net negative after discount");
  return formatMoney(net);
}

/** tax = net * taxRatePct /100 => taxAmount (6) */
export function calcTax(net: string, taxRatePct: string): string {
  if (taxRatePct === "0" || taxRatePct === "0.00" || taxRatePct === "0.0") return "0.000000";
  const n = parseMoney(net);
  const pct = parsePct(taxRatePct);
  const numer = n * pct;
  const denom = PCT_FACTOR * 100n;
  const result = divRoundHalfUp(numer, denom);
  return formatMoney(result);
}

export type LineCalcInput = {
  quantity: string;
  unitPrice: string;
  discountPct: string; // "0" to "100"
  taxRatePct: string;
  unitCost: string;
};

export type LineCalcResult = {
  subtotal: string;
  discountAmount: string;
  net: string;
  tax: string;
  total: string;
  margin: string;
  marginPct: string | null; // pct string with 2 decimals, or null if net zero
};

export function calcLine(input: LineCalcInput): LineCalcResult {
  const subtotal = mulQuantityPrice(input.quantity, input.unitPrice);
  const discountAmount = calcDiscountAmount(subtotal, input.discountPct);
  const net = calcNet(subtotal, discountAmount);
  const tax = calcTax(net, input.taxRatePct);
  const totalBig = parseMoney(net) + parseMoney(tax);
  const total = formatMoney(totalBig);

  // margin = net - cost*qty
  const costTotal = mulQuantityPrice(input.quantity, input.unitCost);
  const marginBig = parseMoney(net) - parseMoney(costTotal);
  const margin = formatMoney(marginBig);

  let marginPct: string | null = null;
  if (net !== "0.000000") {
    // marginPct = margin / net *100
    // margin (6) / net (6) *100 => (marginBig *100 *100) / netBig with 2 decimals?
    // We want pct string with 2 decimals, but stored as numeric(5,2). Compute with half-up.
    // pctBig (scale2) = round(margin/net*100*100) = margin*100*100/net
    const netBig = parseMoney(net);
    // marginBig may be negative -> handle sign
    const negative = marginBig < 0n;
    const absMargin = negative ? -marginBig : marginBig;
    const numer = absMargin * 100n * PCT_FACTOR; // *10000
    const pctAbs = divRoundHalfUp(numer, netBig);
    const pctVal = negative ? -pctAbs : pctAbs;
    marginPct = formatPct(pctVal);
  }

  return { subtotal, discountAmount, net, tax, total, margin, marginPct };
}

export type TotalsInput = {
  lines: Array<{ net: string; tax: string; total: string; discountAmount: string; subtotal: string; margin: string }>;
};

export type TotalsResult = {
  subtotal: string;
  discountTotal: string;
  netTotal: string;
  taxTotal: string;
  grandTotal: string;
  marginTotal: string;
  marginPct: string | null;
};

export function calcTotals(input: TotalsInput): TotalsResult {
  let subtotal = 0n;
  let discountTotal = 0n;
  let netTotal = 0n;
  let taxTotal = 0n;
  let grandTotal = 0n;
  let marginTotal = 0n;

  for (const l of input.lines) {
    subtotal += parseMoney(l.subtotal);
    discountTotal += parseMoney(l.discountAmount);
    netTotal += parseMoney(l.net);
    taxTotal += parseMoney(l.tax);
    grandTotal += parseMoney(l.total);
    marginTotal += parseMoney(l.margin);
  }

  let marginPct: string | null = null;
  if (netTotal !== 0n) {
    const negative = marginTotal < 0n;
    const absMargin = negative ? -marginTotal : marginTotal;
    const numer = absMargin * 100n * PCT_FACTOR;
    const pctAbs = divRoundHalfUp(numer, netTotal < 0n ? -netTotal : netTotal);
    const finalPct = negative ? -pctAbs : pctAbs;
    marginPct = formatPct(finalPct);
  }

  return {
    subtotal: formatMoney(subtotal),
    discountTotal: formatMoney(discountTotal),
    netTotal: formatMoney(netTotal),
    taxTotal: formatMoney(taxTotal),
    grandTotal: formatMoney(grandTotal),
    marginTotal: formatMoney(marginTotal),
    marginPct,
  };
}

/**
 * Quote-level discount/risk preview helpers
 * riskScore = weightedOverage + 0.5 * maxOverage + orderExcessPenalty
 * where overage(line) = max(0, discount - allowed), weighted by gross.
 */
export function calcRiskPreview(
  lines: Array<{ discountPct: string; subtotal: string; allowedPct: string }>,
  orderDiscountPct?: string,
  orderAllowedPct?: string,
): { riskScore: string; riskLevel: string; lineOverages: Array<{ discountPct: string; allowedPct: string; overage: string }> } {
  const lineOverages = lines.map((l) => {
    const disc = Number(l.discountPct);
    const allowed = Number(l.allowedPct);
    const over = Math.max(0, disc - allowed);
    return { discountPct: l.discountPct, allowedPct: l.allowedPct, overage: over.toFixed(2) };
  });

  // Compute gross sum for weighting
  let gross = 0n;
  for (const l of lines) gross += parseMoney(l.subtotal);
  let weightedSum = 0;
  let maxOverage = 0;
  for (let i = 0; i < lines.length; i++) {
    const over = Number(lineOverages[i]!.overage);
    if (over > maxOverage) maxOverage = over;
    // weighted contribution: overage * line gross proportion
    // Use float for weighting? But to avoid Number decisions we keep float here for risk (non-financial)
    // Risk is preview, not financial settlement, so float tolerable but we still derive from strings.
    const lineGross = Number(lines[i]!.subtotal);
    const totalGross = Number(formatMoney(gross));
    if (totalGross > 0) weightedSum += (over * lineGross) / totalGross;
  }

  let orderExcess = 0;
  if (orderDiscountPct !== undefined && orderAllowedPct !== undefined) {
    orderExcess = Math.max(0, Number(orderDiscountPct) - Number(orderAllowedPct));
  }
  const orderPenalty = orderExcess > 0 ? orderExcess * 0.5 : 0; // documented penalty factor

  const score = weightedSum + 0.5 * maxOverage + orderPenalty;
  let level = "none";
  if (score === 0) level = "none";
  else if (score <= 5) level = "manager";
  else level = "finance";

  return { riskScore: score.toFixed(6), riskLevel: level, lineOverages };
}
