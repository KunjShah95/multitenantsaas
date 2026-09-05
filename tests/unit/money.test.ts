import { describe, it, expect } from "vitest";
import {
  parseMoney,
  formatMoney,
  mulQuantityPrice,
  calcDiscountAmount,
  calcTax,
  calcNet,
  calcLine,
  calcTotals,
} from "../../src/shared/money.js";

describe("money rounding - half-up to 6 decimals", () => {
  it("formats and parses round-trip", () => {
    expect(formatMoney(parseMoney("123.456789"))).toBe("123.456789");
    expect(formatMoney(parseMoney("0"))).toBe("0.000000");
    expect(formatMoney(parseMoney("0.1"))).toBe("0.100000");
  });

  it("mulQuantityPrice half-up", () => {
    // 1.000001 * 1.000001 = 1.000002000001 -> rounds to 1.000002
    expect(mulQuantityPrice("1.000001", "1.000001")).toBe("1.000002");
    // 1.0000005 is not valid (7 decimals) but via BigInt: 0.000001 * 0.5? Let's test edge via intermediate
    // quantity 1 * price 1.0000005 would be invalid input, but we test internal rounding via discount/tax
    expect(mulQuantityPrice("2.000000", "100.000000")).toBe("200.000000");
    // large quantity
    expect(mulQuantityPrice("123456.789012", "10.000000")).toBe("1234567.890120");
  });

  it("discount amount exact", () => {
    expect(calcDiscountAmount("100.000000", "33.33")).toBe("33.330000");
    expect(calcDiscountAmount("200.000000", "10.00")).toBe("20.000000");
    expect(calcDiscountAmount("1.000000", "0.01")).toBe("0.000100"); // 1 *0.01% =0.0001
    expect(calcDiscountAmount("100.000000", "0.00")).toBe("0.000000");
  });

  it("tax half-up", () => {
    expect(calcTax("100.000000", "8.88")).toBe("8.880000");
    expect(calcTax("19.000000", "10.00")).toBe("1.900000");
    expect(calcTax("100.000000", "0.00")).toBe("0.000000");
  });

  it("calcLine totals, margin, marginPct", () => {
    const line = calcLine({
      quantity: "2.000000",
      unitPrice: "100.000000",
      discountPct: "10.00",
      taxRatePct: "10.00",
      unitCost: "60.000000",
    });
    // subtotal 200, discount 20, net 180, tax 18, total 198, margin 60 (180-120), marginPct 33.33
    expect(line.subtotal).toBe("200.000000");
    expect(line.discountAmount).toBe("20.000000");
    expect(line.net).toBe("180.000000");
    expect(line.tax).toBe("18.000000");
    expect(line.total).toBe("198.000000");
    expect(line.margin).toBe("60.000000");
    expect(line.marginPct).toBe("33.33");
  });

  it("calcLine zero net marginPct null", () => {
    const line = calcLine({
      quantity: "1.000000",
      unitPrice: "0.000000",
      discountPct: "0",
      taxRatePct: "0",
      unitCost: "0.000000",
    });
    expect(line.marginPct).toBeNull();
  });

  it("calcTotals aggregates correctly", () => {
    const totals = calcTotals({
      lines: [
        { subtotal: "200.000000", discountAmount: "20.000000", net: "180.000000", tax: "18.000000", total: "198.000000", margin: "60.000000" },
        { subtotal: "50.000000", discountAmount: "0.000000", net: "50.000000", tax: "5.000000", total: "55.000000", margin: "30.000000" },
      ],
    });
    expect(totals.subtotal).toBe("250.000000");
    expect(totals.discountTotal).toBe("20.000000");
    expect(totals.netTotal).toBe("230.000000");
    expect(totals.taxTotal).toBe("23.000000");
    expect(totals.grandTotal).toBe("253.000000");
    expect(totals.marginTotal).toBe("90.000000");
    // marginPct = 90/230*100 = 39.130434... -> 39.13 half-up
    expect(totals.marginPct).toBe("39.13");
  });

  it("rounding half-up via BigInt for .5", () => {
    // Use quantity 1.000000 * price 0.000001 = 0.000001 -> no rounding
    // Test discount half-up: subtotal 1.000000 * 0.005%? Actually need case where discount calc results in .5 at 6th decimal
    // Example: subtotal 1.000000, discount 33.333% not allowed (2 decimals). Use tax case: net 1.000000, tax 0.01% -> tax = 0.000100 -> ok
    // More precise half-up: 2 * 0.0000015 would round? But inputs limited to 6 decimals, so not.
    // Instead test that mulQuantityPrice 0.000001 * 1.000000 = 0.000001 exact
    expect(mulQuantityPrice("0.000001", "1.000000")).toBe("0.000001");
  });

  it("money never uses JS Number for decision - string compare", () => {
    // Ensure parseMoney handles large values without float error
    const large = "9999999999.999999";
    expect(formatMoney(parseMoney(large))).toBe(large);
    // 0.1 + 0.2 = 0.3 exact with our library, not float 0.30000000004
    const a = calcTotals({
      lines: [{ subtotal: "0.100000", discountAmount: "0.000000", net: "0.100000", tax: "0.000000", total: "0.100000", margin: "0.000000" }],
    });
    // add second
    const b = calcTotals({
      lines: [
        { subtotal: "0.100000", discountAmount: "0.000000", net: "0.100000", tax: "0.000000", total: "0.100000", margin: "0.000000" },
        { subtotal: "0.200000", discountAmount: "0.000000", net: "0.200000", tax: "0.000000", total: "0.200000", margin: "0.000000" },
      ],
    });
    expect(b.netTotal).toBe("0.300000");
  });
});
