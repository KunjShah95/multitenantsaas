/**
 * Injectable clock for deterministic billing tests.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export type BillingInterval = "monthly" | "quarterly" | "yearly";

export function intervalMonths(interval: BillingInterval): number {
  switch (interval) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "yearly":
      return 12;
  }
}

export function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateOnly(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${s}`);
  return { y, m, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonthsClamped(
  y: number,
  m: number,
  d: number,
  months: number,
): { y: number; m: number; d: number } {
  const totalMonths = y * 12 + (m - 1) + months;
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  const maxD = daysInMonth(newY, newM);
  return { y: newY, m: newM, d: Math.min(d, maxD) };
}

export function datePartsToUtcMidnight(parts: { y: number; m: number; d: number }): Date {
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 0, 0, 0, 0));
}

export type BillingPeriod = {
  periodStart: Date;
  periodEnd: Date;
  nextBillAt: Date;
};

/**
 * Compute the billing period containing `reference` using anchor day and interval.
 * Period is [start, end) in UTC midnight boundaries.
 */
export function computeBillingPeriod(
  anchorDate: string,
  interval: BillingInterval,
  reference: Date,
): BillingPeriod {
  const anchor = parseDateOnly(anchorDate);
  const step = intervalMonths(interval);

  let startParts = anchor;
  let endParts = addMonthsClamped(startParts.y, startParts.m, startParts.d, step);
  let periodStart = datePartsToUtcMidnight(startParts);
  let periodEnd = datePartsToUtcMidnight(endParts);

  while (periodEnd <= reference) {
    startParts = endParts;
    endParts = addMonthsClamped(startParts.y, startParts.m, startParts.d, step);
    periodStart = periodEnd;
    periodEnd = datePartsToUtcMidnight(endParts);
  }

  return {
    periodStart,
    periodEnd,
    nextBillAt: periodEnd,
  };
}

/** Days until due from issue (Net-30). */
export function computeDueAt(issuedAt: Date, netDays = 30): Date {
  const due = new Date(issuedAt.getTime());
  due.setUTCDate(due.getUTCDate() + netDays);
  return due;
}
