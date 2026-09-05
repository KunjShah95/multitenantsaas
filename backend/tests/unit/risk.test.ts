import { describe, it, expect } from "vitest";
import { evaluateRisk } from "../../src/domain/quotes/risk.js";

describe("evaluateRisk pure", () => {
  const basePolicy = {
    tierLimits: [
      { tierCode: "Gold", ceilingPct: "15.00" },
      { tierCode: "Bronze", ceilingPct: "5.00" },
    ],
    categoryLimits: [
      { categoryCode: "Hardware", ceilingPct: "10.00" },
      { categoryCode: "Services", ceilingPct: "20.00" },
    ],
  };

  it("none when no overage", () => {
    const r = evaluateRisk({
      lines: [{ discountPct: "5.00", subtotal: "100.000000", categoryCode: "Hardware" }],
      customerTierCode: "Gold",
      discountPolicy: basePolicy,
    });
    // allowed = min(15,10)=10, requested 5 => overage 0 => none
    expect(r.level).toBe("none");
    expect(r.requiredSteps.length).toBe(0);
    expect(r.score).toBe("0.000000");
  });

  it("category/tier minimum triggers manager", () => {
    // Gold tier 15, Hardware 10 => allowed 10, discount 12 => overage 2
    const r = evaluateRisk({
      lines: [{ discountPct: "12.00", subtotal: "100.000000", categoryCode: "Hardware" }],
      customerTierCode: "Gold",
      discountPolicy: basePolicy,
    });
    expect(r.lines[0]!.allowed).toBe("10.00");
    expect(r.lines[0]!.overage).toBe("2.00");
    // weighted 2, max 2 => score = 2 +1 =3 => manager
    expect(r.level).toBe("manager");
    expect(r.requiredSteps).toHaveLength(1);
    expect(r.requiredSteps[0]!.role).toBe("manager");
    expect(r.reasonCodes).toContain("MAX_OVERAGE");
  });

  it("manager+finance when max overage >=8", () => {
    const r = evaluateRisk({
      lines: [{ discountPct: "18.00", subtotal: "100.000000", categoryCode: "Hardware" }],
      customerTierCode: "Gold",
      discountPolicy: basePolicy,
    });
    // allowed 10, overage 8 => max 8 triggers finance
    expect(r.maxOverage).toBe("8.00");
    expect(r.level).toBe("finance");
    expect(r.requiredSteps).toHaveLength(2);
    expect(r.requiredSteps[1]!.role).toBe("finance");
    expect(r.reasonCodes).toContain("LINE_OVERAGE_GTE_8");
  });

  it("order-level trigger needs finance", () => {
    const r = evaluateRisk({
      lines: [{ discountPct: "5.00", subtotal: "100.000000", categoryCode: "Hardware" }],
      customerTierCode: "Bronze", // tier ceiling 5
      discountPolicy: basePolicy,
      orderDiscountPct: "16.00", // 11 over tier
    });
    // orderOverage 11 >10 => finance
    expect(r.orderOverage).toBe("11.00");
    expect(r.level).toBe("finance");
    expect(r.reasonCodes).toContain("ORDER_DISCOUNT_GTE_TIER_PLUS_10");
  });

  it("empty quote none", () => {
    const r = evaluateRisk({ lines: [], customerTierCode: "Gold", discountPolicy: basePolicy });
    expect(r.level).toBe("none");
    expect(r.reasonCodes).toContain("EMPTY_QUOTE");
  });

  it("mixed quote weighted", () => {
    const r = evaluateRisk({
      lines: [
        { discountPct: "12.00", subtotal: "900.000000", categoryCode: "Hardware" }, // over 2
        { discountPct: "0.00", subtotal: "100.000000", categoryCode: "Hardware" }, // over 0
      ],
      customerTierCode: "Gold",
      discountPolicy: basePolicy,
    });
    // weighted = (2*900)/1000=1.8, max 2 => score 1.8+1=2.8 => manager
    expect(r.weightedOverage).toBe("1.800000");
    expect(r.level).toBe("manager");
  });

  it("rounding preserves decimals", () => {
    const r = evaluateRisk({
      lines: [{ discountPct: "10.01", subtotal: "33.333333", categoryCode: "Hardware" }],
      customerTierCode: "Gold",
      discountPolicy: basePolicy,
    });
    // allowed 10, over 0.01 => weighted 0.01 => score 0.015 => 0.02 after rounding? Actually raw 0.015 rounds to 0.02
    // But ensure string has 6 decimals
    expect(r.score.split(".")[1]!.length).toBe(6);
  });

  it("respects custom managerUpTo threshold", () => {
    const rLow = evaluateRisk({
      lines: [{ discountPct: "12.00", subtotal: "100.000000", categoryCode: "Hardware" }],
      customerTierCode: "Gold",
      discountPolicy: basePolicy,
      managerUpTo: 2,
    });
    // score 3 >2 => finance
    expect(rLow.level).toBe("finance");
  });

  it("uses approvalPolicy steps when provided", () => {
    const r = evaluateRisk({
      lines: [{ discountPct: "12.00", subtotal: "100.000000", categoryCode: "Hardware" }],
      customerTierCode: "Gold",
      discountPolicy: basePolicy,
      approvalPolicy: {
        steps: [
          { sequence: 1, role: "manager" },
          { sequence: 2, role: "finance" },
        ],
      },
    });
    expect(r.requiredSteps[0]!.role).toBe("manager");
  });
});
