import { describe, expect, it } from "vitest";

import { minCVaR, pathCVaR } from "./cvar";
import { carTStat, earningsCars, meanCar } from "./eventstudy";
import { famaFrench3, olsMulti } from "./factors";
import { dividendDiscount, residualIncome } from "./residual-income";
import { historicalVaR } from "./var";

function close(a: number, b: number, eps = 1e-8) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("mean-CVaR", () => {
  it("keeps CVaR ≥ VaR on a fat left tail", () => {
    const r = [0.01, 0.01, 0.01, 0.01, -0.08, 0.02, -0.12, 0.01, 0.00, -0.05, 0.03, 0.01];
    const res = historicalVaR(r, 0.8);
    expect(res.cvar).toBeGreaterThanOrEqual(res.var - 1e-12);
  });

  it("puts 100% on the asset that never appears in the left tail", () => {
    const returns = Array.from({ length: 40 }, () => [-0.04, 0.008]);
    const w = minCVaR(returns, 0.95, 200);
    expect(w[1]!).toBeGreaterThan(0.95);
    expect(pathCVaR(w, returns, 0.95)).toBeLessThan(pathCVaR([1, 0], returns, 0.95));
  });
});

describe("Fama–French OLS", () => {
  it("recovers y = α + β_m MKT + β_s SMB + β_h HML", () => {
    const n = 80;
    const mkt = Array.from({ length: n }, (_, i) => 0.01 * Math.sin(i / 3));
    const smb = Array.from({ length: n }, (_, i) => 0.008 * Math.cos(i / 5));
    const hml = Array.from({ length: n }, (_, i) => 0.006 * Math.sin(i / 7 + 1));
    const y = mkt.map((m, i) => 0.0004 + 1.2 * m + 0.35 * smb[i]! - 0.2 * hml[i]!);
    const ff = famaFrench3(y, mkt, smb, hml, 0);
    close(ff.alpha, 0.0004, 1e-8);
    close(ff.mkt, 1.2, 1e-8);
    close(ff.smb, 0.35, 1e-8);
    close(ff.hml, -0.2, 1e-8);
    close(ff.r2, 1, 1e-8);
  });

  it("solves a two-column design exactly", () => {
    const X = [
      [1, 0],
      [1, 1],
      [1, 2],
    ];
    const y = [2, 3, 4];
    const { beta } = olsMulti(y, X);
    close(beta[0]!, 2, 1e-8);
    close(beta[1]!, 1, 1e-8);
  });
});

describe("residual income", () => {
  it("collapses to book value when ROE equals the cost of equity", () => {
    const res = residualIncome({
      bookValue: 50,
      roe: 0.09,
      costEquity: 0.09,
      growth: 0.03,
      years: 8,
    });
    close(res.pvResidual, 0, 1e-10);
    close(res.equityValue, 50, 1e-8);
  });

  it("matches Gordon on a growing dividend", () => {
    close(dividendDiscount(2, 0.08, 0.03), 2 * 1.03 / 0.05);
  });

  it("keeps only year-1 residual when fade is 0", () => {
    const res = residualIncome({
      bookValue: 50,
      roe: 0.15,
      costEquity: 0.1,
      growth: 0.03,
      years: 6,
      fade: 0,
    });
    close(res.pvResidual, ((0.15 - 0.1) * 50) / 1.1, 1e-10);
    close(res.pvTerminal, 0, 1e-10);
  });
});

describe("earnings event study", () => {
  it("gives CAR = 0 when the name tracks the market", () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2024-01-${String(i + 10).padStart(2, "0")}`);
    let p = 100;
    const asset = dates.map((date) => {
      p *= 1.01;
      return { date, price: p };
    });
    const market = asset.map((b) => ({ ...b }));
    const cars = earningsCars(asset, market, ["2024-01-14"], 1, 1);
    expect(cars.length).toBe(1);
    close(cars[0]!.car, 0, 1e-12);
    close(meanCar(cars), 0, 1e-12);
  });

  it("isolates a one-day abnormal on the event date", () => {
    const dates = ["2024-03-01", "2024-03-04", "2024-03-05", "2024-03-06"];
    const market = [
      { date: dates[0]!, price: 100 },
      { date: dates[1]!, price: 101 },
      { date: dates[2]!, price: 102.01 },
      { date: dates[3]!, price: 103.0301 },
    ];
    const asset = [
      { date: dates[0]!, price: 50 },
      { date: dates[1]!, price: 50.5 },
      { date: dates[2]!, price: 50.5 * 1.06 },
      { date: dates[3]!, price: 50.5 * 1.06 * 1.01 },
    ];
    const cars = earningsCars(asset, market, ["2024-03-05"], 0, 0);
    close(cars[0]!.car, 0.05, 1e-10);
  });

  it("gives t = mean / (s/√n) on two events", () => {
    const points = [
      { date: "a", car: 0.02, ar0: 0.02, n: 1 },
      { date: "b", car: 0.04, ar0: 0.04, n: 1 },
    ];
    const stat = carTStat(points);
    close(stat.mean, 0.03);
    close(stat.se, 0.01);
    close(stat.t, 3);
  });
});
