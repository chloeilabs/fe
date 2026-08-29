import { describe, expect, it } from "vitest";

import { convexity, earningsYieldGap, modifiedDuration, priceChange, zeroPrice } from "./bonds";
import { effectiveSegments, herfindahl } from "./concentration";
import { bartlett, neweyWest } from "./hac";
import {
  amihudIlliquidity,
  closeToCloseVar,
  garmanKlassVar,
  parkinsonVar,
  rogersSatchellVar,
  rollImpliedSpread,
  skipMonthMomentum,
  yangZhangVar,
} from "./realized";
import { treynorBlack } from "./treynor-black";

function close(a: number, b: number, eps = 1e-8) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("OHLC realized variance", () => {
  it("is zero when the bar does not move", () => {
    const bars = [
      { date: "2024-01-02", open: 10, high: 10, low: 10, close: 10, volume: 1e6 },
      { date: "2024-01-03", open: 10, high: 10, low: 10, close: 10, volume: 1e6 },
      { date: "2024-01-04", open: 10, high: 10, low: 10, close: 10, volume: 1e6 },
    ];
    close(closeToCloseVar(bars), 0);
    close(parkinsonVar(bars), 0);
    close(garmanKlassVar(bars), 0);
    close(rogersSatchellVar(bars), 0);
    close(yangZhangVar(bars), 0);
  });

  it("matches Parkinson σ² = ln(H/L)² / (4 ln 2) on a constant range", () => {
    const bars = Array.from({ length: 8 }, (_, i) => ({
      date: `2024-02-0${i + 1}`,
      open: 100,
      high: 100 * Math.E,
      low: 100,
      close: 100,
      volume: 1e6,
    }));
    close(parkinsonVar(bars), 1 / (4 * Math.log(2)), 1e-12);
  });

  it("matches Amihud |r| / (P V) on one move", () => {
    const bars = [
      { date: "2024-03-01", open: 100, high: 100, low: 100, close: 100, volume: 1e3 },
      { date: "2024-03-04", open: 101, high: 101, low: 101, close: 101, volume: 1e3 },
    ];
    close(amihudIlliquidity(bars), 0.01 / (101 * 1e3), 1e-14);
  });

  it("recovers 12–1 skip-month momentum on a constant daily growth", () => {
    const prices = Array.from({ length: 260 }, (_, i) => ({
      date: `2023-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
      price: 100 * 1.01 ** i,
    }));
    const mom = skipMonthMomentum(prices);
    expect(mom).not.toBeNull();
    close(mom!, 1.01 ** 231 - 1, 1e-10);
  });

  it("matches Roll s = 2 √(−cov) on a pure bid–ask bounce", () => {
    const returns = [0.01, -0.01, 0.01, -0.01, 0.01, -0.01, 0.01, -0.01];
    close(rollImpliedSpread(returns), 0.02, 1e-12);
  });
});

describe("Herfindahl and Fed model", () => {
  it("is 1/n for equal shares and 1 for a monopoly", () => {
    close(herfindahl([10, 10, 10]), 1 / 3, 1e-12);
    close(herfindahl([1]), 1, 1e-12);
    close(effectiveSegments(0.25), 4, 1e-12);
  });

  it("is zero when PE equals the reciprocal of the 10y yield", () => {
    close(earningsYieldGap(20, 5)!, 0, 1e-12);
    close(earningsYieldGap(25, 0.04)!, 0, 1e-12);
  });
});

describe("Newey–West", () => {
  it("uses the Bartlett weight 1 − ℓ/(L+1)", () => {
    close(bartlett(1, 3), 0.75, 1e-12);
    close(bartlett(0, 3), 1, 1e-12);
  });

  it("matches √(SSE)/n for an intercept-only lag-0 HAC", () => {
    const y = [1, 2, 3, 4];
    const X = y.map(() => [1]);
    const nw = neweyWest(y, X, 0);
    close(nw.beta[0]!, 2.5, 1e-12);
    const sse = 1.5 ** 2 + 0.5 ** 2 + 0.5 ** 2 + 1.5 ** 2;
    close(nw.se[0]!, Math.sqrt(sse) / 4, 1e-12);
  });
});

describe("zero-coupon duration", () => {
  it("matches P = (1+y)^{−τ} and D_mod = τ/(1+y)", () => {
    const y = 0.05;
    const tau = 10;
    close(zeroPrice(y, tau), 1.05 ** -10, 1e-12);
    close(modifiedDuration(y, tau), 10 / 1.05, 1e-12);
    close(convexity(y, tau), (10 * 11) / 1.05 ** 2, 1e-12);
  });

  it("matches the second-order Taylor ΔP/P", () => {
    const y = 0.04;
    const tau = 7;
    const dy = 0.001;
    const p0 = zeroPrice(y, tau);
    const p1 = zeroPrice(y + dy, tau);
    close(priceChange(y, tau, dy), p1 / p0 - 1, 1e-7);
  });
});

describe("Treynor–Black", () => {
  it("puts 100% of the active book on the only positive-α name", () => {
    const res = treynorBlack(
      [
        { alpha: 0.002, residualVar: 0.0004, beta: 1 },
        { alpha: 0, residualVar: 0.0004, beta: 1 },
      ],
      0.0003,
      0.0001,
      [0.5, 0.5],
      true,
    );
    expect(res.activeWeights[0]!).toBeGreaterThan(0.99);
    expect(res.activeWeights[1]!).toBeLessThan(0.01);
    expect(res.wActive).toBeGreaterThan(0);
  });

  it("stays on the passive mix when every α is 0", () => {
    const res = treynorBlack(
      [
        { alpha: 0, residualVar: 0.0004, beta: 1.1 },
        { alpha: 0, residualVar: 0.0004, beta: 0.8 },
      ],
      0.0003,
      0.0001,
      [0.7, 0.3],
      true,
    );
    close(res.wActive, 0, 1e-12);
    close(res.weights[0]!, 0.7, 1e-12);
    close(res.weights[1]!, 0.3, 1e-12);
  });
});
