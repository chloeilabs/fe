import { describe, expect, it } from "vitest";

import { money } from "../format";
import { fireNumber, futureValue, monteCarloProjection, requiredMonthlyContribution, yearsToTarget } from "./wealth";

describe("money format", () => {
  it("uses a stable compact suffix instead of locale compact notation", () => {
    expect(money(1_800_000, true)).toBe("$1.80M");
    expect(money(2_142, false)).toBe("$2,142.00");
  });
});


describe("wealth engine", () => {
  it("compounds a lump sum with monthly contributions", () => {
    const fv = futureValue({
      presentValue: 100_000,
      monthlyContribution: 1_000,
      annualReturn: 0.07,
      inflation: 0,
      years: 10,
    });
    expect(fv).toBeGreaterThan(360_000);
    expect(fv).toBeLessThan(380_000);
  });

  it("solves required savings for a target", () => {
    const pmt = requiredMonthlyContribution({
      presentValue: 50_000,
      annualReturn: 0.07,
      years: 20,
      target: 1_000_000,
    });
    const fv = futureValue({
      presentValue: 50_000,
      monthlyContribution: pmt,
      annualReturn: 0.07,
      years: 20,
    });
    expect(fv).toBeGreaterThan(990_000);
    expect(fv).toBeLessThan(1_010_000);
  });

  it("finds years to a FIRE number", () => {
    const years = yearsToTarget({
      presentValue: 180_000,
      monthlyContribution: 2500,
      annualReturn: 0.07,
      inflation: 0.025,
      target: fireNumber(72_000, 0.04),
    });
    expect(years).not.toBeNull();
    expect(years!).toBeGreaterThan(10);
    expect(years!).toBeLessThan(30);
  });

  it("returns a Monte Carlo fan with a seeded median", () => {
    const result = monteCarloProjection({
      presentValue: 100_000,
      monthlyContribution: 1000,
      annualReturn: 0.07,
      annualVolatility: 0.15,
      years: 15,
      paths: 400,
      seed: 42,
      target: 400_000,
    });
    expect(result.p50).toHaveLength(16);
    expect(result.medianEnd).toBeGreaterThan(result.p10.at(-1)!);
    expect(result.medianEnd).toBeLessThan(result.p90.at(-1)!);
    expect(result.successRate).toBeGreaterThan(0);
    expect(result.successRate).toBeLessThanOrEqual(1);
  });
});
