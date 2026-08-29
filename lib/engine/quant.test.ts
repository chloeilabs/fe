import { describe, expect, it } from "vitest";

import { capm } from "./capm";
import { isSpd, ledoitWolfShrink, sampleCovariance } from "./covariance";
import { gordon, twoStageFcff } from "./dcf";
import { kellyFraction, kellyGrowth } from "./kelly";
import {
  cholesky,
  identity,
  inverseSPD,
  jacobiEigen,
  multiply,
  projectSimplex,
  quadratic,
  transpose,
} from "./matrix";
import {
  blackLitterman,
  equalWeight,
  globalMinVariance,
  maxSharpe,
  portfolioMoments,
  riskContributions,
  riskParity,
  scaleHoldingsToWeights,
} from "./optimize";
import { invNorm, parametricVaR } from "./var";

function close(a: number, b: number, eps = 1e-6) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("matrix identities", () => {
  it("recovers A from Cholesky L L'", () => {
    const A = [
      [4, 2, 0.5],
      [2, 5, 1],
      [0.5, 1, 3],
    ];
    const L = cholesky(A);
    const recon = multiply(L, transpose(L));
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        close(recon[i]![j]!, A[i]![j]!, 1e-8);
      }
    }
  });

  it("inverts an SPD matrix", () => {
    const A = [
      [4, 1],
      [1, 3],
    ];
    const I = multiply(A, inverseSPD(A));
    close(I[0]![0]!, 1, 1e-6);
    close(I[1]![1]!, 1, 1e-6);
    close(I[0]![1]!, 0, 1e-6);
  });

  it("projects onto the probability simplex", () => {
    const w = projectSimplex([1.2, -0.4, 0.3]);
    expect(w.every((x) => x >= -1e-12)).toBe(true);
    close(w.reduce((s, x) => s + x, 0), 1);
  });

  it("returns orthonormal Jacobi eigenvectors", () => {
    const A = [
      [2, 0.4],
      [0.4, 1],
    ];
    const { values, vectors } = jacobiEigen(A);
    expect(values[0]!).toBeGreaterThan(values[1]!);
    const cols = transpose(vectors);
    close(cols[0]!.reduce((s, x, i) => s + x * cols[1]![i]!, 0), 0, 1e-8);
    const recon = multiply(vectors, multiply(identity(2).map((row, i) => row.map((v, j) => (i === j ? values[i]! : 0))), transpose(vectors)));
    close(recon[0]![0]!, A[0]![0]!, 1e-6);
  });
});

describe("Markowitz / GMV / ERC", () => {
  it("gives inverse-variance GMV on uncorrelated assets (80/20)", () => {
    const cov = [
      [0.01, 0],
      [0, 0.04],
    ];
    const w = globalMinVariance(cov);
    close(w[0]!, 0.8, 1e-8);
    close(w[1]!, 0.2, 1e-8);
    close(w[0]! + w[1]!, 1);
    const gmvVar = quadratic(w, cov);
    const ewVar = quadratic(equalWeight(2), cov);
    expect(gmvVar).toBeLessThanOrEqual(ewVar + 1e-12);
  });

  it("equalizes risk contributions on uncorrelated 10%/20% vols", () => {
    const cov = [
      [0.01, 0],
      [0, 0.04],
    ];
    const w = riskParity(cov);
    close(w[0]!, 2 / 3, 1e-3);
    close(w[1]!, 1 / 3, 1e-3);
    const rc = riskContributions(w, cov);
    close(rc[0]!, 0.5, 1e-3);
    close(rc[1]!, 0.5, 1e-3);
  });

  it("recovers market weights from Black–Litterman with no views", () => {
    const cov = [
      [0.04, 0.01],
      [0.01, 0.09],
    ];
    const wMkt = [0.62, 0.38];
    const pi = blackLitterman(cov, wMkt, []);
    const expected = [2.5 * (0.04 * 0.62 + 0.01 * 0.38), 2.5 * (0.01 * 0.62 + 0.09 * 0.38)];
    close(pi[0]!, expected[0]!, 1e-10);
    close(pi[1]!, expected[1]!, 1e-10);
    const tangency = maxSharpe(pi, cov, 0, false);
    close(tangency[0]!, wMkt[0]!, 1e-8);
    close(tangency[1]!, wMkt[1]!, 1e-8);
  });
});

describe("Ledoit–Wolf", () => {
  it("returns a shrinkage intensity in [0, 1] and an SPD matrix", () => {
    const returns = Array.from({ length: 80 }, (_, t) => [
      0.001 + 0.01 * Math.sin(t / 3),
      0.0004 + 0.02 * Math.cos(t / 5),
      -0.0002 + 0.015 * Math.sin(t / 7),
    ]);
    const lw = ledoitWolfShrink(returns);
    expect(lw.delta).toBeGreaterThanOrEqual(0);
    expect(lw.delta).toBeLessThanOrEqual(1);
    expect(isSpd(lw.shrunk)).toBe(true);
    const sample = sampleCovariance(returns);
    expect(sample.cov.length).toBe(3);
  });
});

describe("CAPM OLS", () => {
  it("recovers alpha and beta on y = 0.001 + 1.5 x", () => {
    const x = [-0.02, -0.01, 0, 0.01, 0.02, 0.03, -0.015];
    const y = x.map((v) => 0.001 + 1.5 * v);
    const fit = capm(y, x);
    close(fit.beta, 1.5, 1e-10);
    close(fit.alpha, 0.001, 1e-10);
    close(fit.r2, 1, 1e-10);
  });
});

describe("two-stage FCFF", () => {
  it("collapses to Gordon growth when stage-1 growth equals terminal growth", () => {
    const fcff = 100;
    const r = 0.09;
    const g = 0.03;
    const model = twoStageFcff({
      fcff,
      shares: 10,
      netDebt: 50,
      growthHigh: g,
      growthStable: g,
      yearsHigh: 6,
      wacc: r,
    });
    close(model.enterpriseValue, gordon(fcff, r, g), 1e-6);
    close(model.equityValue, model.enterpriseValue - 50, 1e-9);
    close(model.perShare, model.equityValue / 10, 1e-9);
  });
});

describe("VaR and Kelly", () => {
  it("matches the inverse normal at known quantiles", () => {
    close(invNorm(0.5), 0, 1e-12);
    close(invNorm(0.975), 1.95996398454, 5e-6);
    close(invNorm(0.95), 1.64485362695, 5e-6);
  });

  it("gives Gaussian parametric VaR μ + σ Φ^{-1}(1-α)", () => {
    const returns = Array.from({ length: 200 }, () => 0.001);
    const res = parametricVaR(returns, 0.95);
    close(res.mean, 0.001, 1e-12);
    close(res.vol, 0, 1e-12);
    close(res.var, -0.001, 1e-12);
  });

  it("uses f* = μ/σ² and growth μf − ½σ²f²", () => {
    const mu = 0.08;
    const sigma2 = 0.04;
    const f = kellyFraction(mu, sigma2);
    close(f, 2);
    close(kellyGrowth(mu, sigma2, f), 0.08);
  });
});

describe("rebalance lots", () => {
  it("scales lots so symbol weights match the target", () => {
    const next = scaleHoldingsToWeights(
      [
        { symbol: "A", shares: 10 },
        { symbol: "B", shares: 10 },
      ],
      (s) => (s === "A" ? 10 : 5),
      { A: 0.5, B: 0.5 },
    );
    const va = next[0]!.shares * 10;
    const vb = next[1]!.shares * 5;
    close(va, vb, 1e-8);
  });
});

describe("moments", () => {
  it("computes w'μ and sqrt(w'Σw)", () => {
    const mu = [0.1, 0.2];
    const cov = [
      [0.04, 0],
      [0, 0.09],
    ];
    const m = portfolioMoments([0.5, 0.5], mu, cov, 0);
    close(m.expectedReturn, 0.15);
    close(m.volatility, Math.sqrt(0.0325));
  });
});
