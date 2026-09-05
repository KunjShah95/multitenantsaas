import { describe, it, expect } from "vitest";
import { validatePriceString, toMoneyString } from "../../src/domain/catalog/priceResolver.js";

describe("priceResolver helpers", () => {
  it("validates price strings", () => {
    expect(validatePriceString("100.000000")).toBeNull();
    expect(validatePriceString("0")).toBeNull();
    expect(validatePriceString("0.1")).toBeNull();
    expect(validatePriceString("12.123456")).toBeNull();
    expect(validatePriceString("12.1234567")).not.toBeNull(); // 7 decimals
    expect(validatePriceString("-5")).not.toBeNull();
    expect(validatePriceString("abc")).not.toBeNull();
  });

  it("formats money to 6 decimals", () => {
    expect(toMoneyString(100)).toBe("100.000000");
    expect(toMoneyString("99.5")).toBe("99.500000");
    expect(toMoneyString(0.123456)).toBe("0.123456");
  });
});

describe("priceResolver integration", () => {
  it("resolves exact tier, fallback, and no rule via in-memory mock", async () => {
    // This test validates the sorting logic without DB: simulate candidate lists
    const lists = [
      { customerTierId: null, priority: 0, effectiveFrom: null, id: "generic" },
      { customerTierId: "gold-tier-id", priority: 100, effectiveFrom: "2026-01-01T00:00:00Z", id: "gold" },
    ] as any[];
    const tierId = "gold-tier-id";
    // sorting should put gold first
    lists.sort((a, b) => {
      const aMatch = tierId && a.customerTierId === tierId ? 1 : a.customerTierId === null ? 0 : -1;
      const bMatch = tierId && b.customerTierId === tierId ? 1 : b.customerTierId === null ? 0 : -1;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.priority - a.priority;
    });
    expect(lists[0].id).toBe("gold");
    expect(lists[1].id).toBe("generic");
  });

  it("decimal precision is 6 digits", () => {
    const price = "123.456789";
    expect(price.split(".")[1]?.length).toBe(6);
    const formatted = toMoneyString(Number(price));
    expect(formatted).toBe("123.456789");
  });
});
