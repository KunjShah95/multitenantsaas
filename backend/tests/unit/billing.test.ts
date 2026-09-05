import { describe, it, expect } from "vitest";
import {
  addMonthsClamped,
  computeBillingPeriod,
  computeDueAt,
  formatDateOnly,
} from "../../src/domain/billing/schedule.js";
import {
  computeProration,
  computeCancellationCredit,
  computePeriodAmount,
} from "../../src/domain/billing/proration.js";

describe("billing schedule", () => {
  it("clamps month-end anchors (Jan 31 + 1 month = Feb 28)", () => {
    expect(addMonthsClamped(2026, 1, 31, 1)).toEqual({ y: 2026, m: 2, d: 28 });
    expect(addMonthsClamped(2028, 1, 31, 1)).toEqual({ y: 2028, m: 2, d: 29 });
  });

  it("computes monthly period containing reference", () => {
    const period = computeBillingPeriod(
      "2026-01-15",
      "monthly",
      new Date("2026-01-20T12:00:00.000Z"),
    );
    expect(formatDateOnly(period.periodStart)).toBe("2026-01-15");
    expect(formatDateOnly(period.periodEnd)).toBe("2026-02-15");
    expect(period.nextBillAt.toISOString()).toBe(period.periodEnd.toISOString());
  });

  it("advances quarterly and yearly intervals past the reference", () => {
    const q = computeBillingPeriod("2026-01-01", "quarterly", new Date("2026-04-02T00:00:00.000Z"));
    expect(formatDateOnly(q.periodStart)).toBe("2026-04-01");
    expect(formatDateOnly(q.periodEnd)).toBe("2026-07-01");

    const y = computeBillingPeriod("2025-09-05", "yearly", new Date("2026-09-06T00:00:00.000Z"));
    expect(formatDateOnly(y.periodStart)).toBe("2026-09-05");
    expect(formatDateOnly(y.periodEnd)).toBe("2027-09-05");
  });

  it("computes Net-30 due dates in UTC", () => {
    const issued = new Date("2026-01-01T00:00:00.000Z");
    expect(computeDueAt(issued, 30).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("proration", () => {
  const periodStart = new Date("2026-01-01T00:00:00.000Z");
  const periodEnd = new Date("2026-02-01T00:00:00.000Z");
  const mid = new Date("2026-01-16T00:00:00.000Z");

  const terms = {
    quantity: "1.000000",
    unitPrice: "100.000000",
    discountPct: "0.00",
    taxRatePct: "10.00",
  };

  it("computes period amount with tax", () => {
    const amt = computePeriodAmount(terms);
    expect(amt.net).toBe("100.000000");
    expect(amt.tax).toBe("10.000000");
    expect(amt.total).toBe("110.000000");
  });

  it("creates a debit when remaining quantity increases", () => {
    const result = computeProration(
      terms,
      { ...terms, quantity: "2.000000" },
      periodStart,
      periodEnd,
      mid,
    );
    expect(result.direction).toBe("debit");
    expect(Number(result.totalDelta)).toBeGreaterThan(0);
  });

  it("creates a credit when remaining quantity decreases", () => {
    const result = computeProration(
      { ...terms, quantity: "2.000000" },
      terms,
      periodStart,
      periodEnd,
      mid,
    );
    expect(result.direction).toBe("credit");
    expect(Number(result.totalDelta)).toBeGreaterThan(0);
  });

  it("rejects effective dates outside the current period", () => {
    expect(() =>
      computeProration(terms, terms, periodStart, periodEnd, new Date("2026-02-01T00:00:00.000Z")),
    ).toThrow(/after current period/);
  });

  it("credits remaining period on cancel (credit_remaining)", () => {
    const credit = computeCancellationCredit(
      terms,
      "credit_remaining",
      periodStart,
      periodEnd,
      mid,
    );
    expect(credit.direction).toBe("credit");
    expect(Number(credit.creditTotal)).toBeGreaterThan(0);
  });

  it("returns no credit when cancel policy is no_refund", () => {
    const credit = computeCancellationCredit(terms, "no_refund", periodStart, periodEnd, mid);
    expect(credit.direction).toBe("none");
    expect(credit.creditTotal).toBe("0.000000");
  });
});
