import { describe, expect, it } from "vitest";

import {
  alignedReturns,
  annualizedVol,
  betaVsMarket,
  effectiveN,
  maxDrawdown,
  portfolioReturns,
  sharpeRatio,
  simpleReturns,
} from "./risk";

const upTrend = [
  { date: "2024-01-02", price: 100 },
  { date: "2024-01-03", price: 110 },
  { date: "2024-01-04", price: 105 },
  { date: "2024-01-05", price: 120 },
];

describe("risk engine", () => {
  it("computes simple returns and max drawdown", () => {
    const rets = simpleReturns(upTrend);
    expect(rets[0]).toBeCloseTo(0.1);
    expect(maxDrawdown(upTrend).maxDrawdown).toBeCloseTo(105 / 110 - 1);
  });

  it("builds portfolio returns and beta vs a market series", () => {
    const a = [
      { date: "2024-01-02", price: 100 },
      { date: "2024-01-03", price: 102 },
      { date: "2024-01-04", price: 101 },
      { date: "2024-01-05", price: 104 },
    ];
    const m = [
      { date: "2024-01-02", price: 200 },
      { date: "2024-01-03", price: 202 },
      { date: "2024-01-04", price: 201 },
      { date: "2024-01-05", price: 206 },
    ];
    const { returns } = alignedReturns({ AAPL: a, SPY: m });
    const port = portfolioReturns({ AAPL: 1 }, { AAPL: returns.AAPL ?? [] });
    expect(port).toHaveLength(3);
    const beta = betaVsMarket(returns.AAPL ?? [], returns.SPY ?? []);
    expect(beta).toBeGreaterThan(0);
    expect(annualizedVol(port)).toBeGreaterThan(0);
    expect(Number.isFinite(sharpeRatio(port, 0.04))).toBe(true);
  });

  it("measures diversification via effective N", () => {
    expect(effectiveN([1])).toBeCloseTo(1);
    expect(effectiveN([0.5, 0.5])).toBeCloseTo(2);
    expect(effectiveN([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(4);
  });
});
