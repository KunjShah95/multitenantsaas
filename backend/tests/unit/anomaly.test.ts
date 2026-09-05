import { describe, it, expect } from "vitest";
import {
  calculateDiscountStats,
  evaluateDiscountAnomaly,
} from "../../src/domain/health/health.service.js";

describe("health anomaly detection", () => {
  describe("calculateDiscountStats", () => {
    it("handles empty discounts", () => {
      const stats = calculateDiscountStats([]);
      expect(stats.sampleCount).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.stddev).toBe(0);
    });

    it("handles single discount", () => {
      const stats = calculateDiscountStats([10]);
      expect(stats.sampleCount).toBe(1);
      expect(stats.mean).toBe(10);
      expect(stats.stddev).toBe(0);
    });

    it("computes sample mean and sample standard deviation accurately", () => {
      // [10, 12, 8, 10, 10]: mean = 10, variance = (0 + 4 + 4 + 0 + 0) / 4 = 2, stddev = sqrt(2) ≈ 1.4142
      const stats = calculateDiscountStats([10, 12, 8, 10, 10]);
      expect(stats.sampleCount).toBe(5);
      expect(stats.mean).toBe(10);
      expect(stats.stddev).toBeCloseTo(Math.sqrt(2), 3);
    });
  });

  describe("evaluateDiscountAnomaly", () => {
    it("rejects anomaly when sample size is below minimum (e.g. < 5)", () => {
      const stats = calculateDiscountStats([5, 6, 7]);
      const result = evaluateDiscountAnomaly(25, stats, 5);
      expect(result.isAnomaly).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("does not flag typical discounts within standard threshold", () => {
      const stats = calculateDiscountStats([8, 10, 9, 11, 10, 12]);
      const result = evaluateDiscountAnomaly(11, stats, 5);
      expect(result.isAnomaly).toBe(false);
    });

    it("flags discount exceeding 2 standard deviations and threshold", () => {
      const stats = calculateDiscountStats([5, 6, 5, 7, 5, 6]); // mean ~5.67, stddev ~0.82
      const result = evaluateDiscountAnomaly(18, stats, 5);
      expect(result.isAnomaly).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.confidence).toBeLessThanOrEqual(99);
      expect(result.reason).toContain("exceeds the threshold");
    });

    it("increases confidence factor with larger sample sizes and deviations", () => {
      const statsSmall = calculateDiscountStats([5, 5, 5, 5, 5]);
      const statsLarge = calculateDiscountStats(Array(15).fill(5));

      const resSmall = evaluateDiscountAnomaly(20, statsSmall, 5);
      const resLarge = evaluateDiscountAnomaly(20, statsLarge, 5);

      expect(resLarge.confidence).toBeGreaterThan(resSmall.confidence);
    });
  });
});
