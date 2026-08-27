import {
  annualizeCov,
  annualizeMu,
  ledoitWolfShrink,
} from "@/lib/engine/covariance";
import {
  inverseSPD,
  mv,
  ones,
  projectSimplex,
  quadratic,
  scale,
  solveSPD,
  vecAdd,
  vecScale,
} from "@/lib/engine/matrix";

export type OptimizerKind = "gmv" | "max-sharpe" | "erc" | "equal" | "bl";

export type OptimizeResult = {
  weights: number[];
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  kind: OptimizerKind;
};

export function portfolioMoments(
  weights: number[],
  mu: number[],
  cov: number[][],
  rf = 0,
): { expectedReturn: number; volatility: number; sharpe: number } {
  const expectedReturn = weights.reduce((s, w, i) => s + w * (mu[i] ?? 0), 0);
  const variance = quadratic(weights, cov);
  const volatility = Math.sqrt(Math.max(variance, 0));
  const sharpe = volatility > 1e-12 ? (expectedReturn - rf) / volatility : 0;
  return { expectedReturn, volatility, sharpe };
}

export function globalMinVariance(
  cov: number[][],
  longOnly = false,
): number[] {
  const n = cov.length;
  const invOne = solveSPD(cov, ones(n));
  const sum = invOne.reduce((s, v) => s + v, 0);
  let w = invOne.map((v) => v / (sum || 1));
  if (!longOnly) return w;
  w = projectSimplex(w);
  let lr = 0.25;
  for (let k = 0; k < 400; k += 1) {
    const grad = mv(cov, w);
    const trial = projectSimplex(vecAdd(w, vecScale(grad, -lr)));
    if (quadratic(trial, cov) <= quadratic(w, cov) + 1e-18) {
      w = trial;
      lr *= 1.05;
    } else {
      lr *= 0.5;
    }
    if (lr < 1e-10) break;
  }
  return w;
}

export function maxSharpe(
  mu: number[],
  cov: number[][],
  rf = 0,
  longOnly = false,
): number[] {
  const excess = mu.map((m) => m - rf);
  let w = solveSPD(cov, excess);
  const sum = w.reduce((s, v) => s + v, 0);
  if (Math.abs(sum) < 1e-12) return globalMinVariance(cov, longOnly);
  w = w.map((v) => v / sum);
  if (longOnly) {
    w = projectedGradientMaxSharpe(mu, cov, rf, 400);
  }
  return w;
}

function projectedGradientMaxSharpe(
  mu: number[],
  cov: number[][],
  rf: number,
  steps: number,
): number[] {
  const n = mu.length;
  let w = projectSimplex(ones(n).map(() => 1 / n));
  let lr = 0.08;
  for (let k = 0; k < steps; k += 1) {
    const { sharpe } = portfolioMoments(w, mu, cov, rf);
    const sigma2 = Math.max(quadratic(w, cov), 1e-12);
    const sigma = Math.sqrt(sigma2);
    const excess = mu.map((m) => m - rf);
    const covW = mv(cov, w);
    const rp = w.reduce((s, wi, i) => s + wi * excess[i], 0);
    const grad = excess.map(
      (e, i) => (e * sigma - rp * (covW[i] / sigma)) / sigma2,
    );
    const trial = projectSimplex(vecAdd(w, vecScale(grad, lr)));
    const next = portfolioMoments(trial, mu, cov, rf);
    if (next.sharpe >= sharpe - 1e-12) {
      w = trial;
      lr *= 1.02;
    } else {
      lr *= 0.5;
    }
    if (lr < 1e-8) break;
  }
  return w;
}

export function equalWeight(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n);
}

/**
 * Equal risk contribution (Maillard, Roncalli, Teiletche).
 * Multiplicative updates until RC_i ≈ σ² / n.
 */
export function riskParity(cov: number[][], iterations = 800): number[] {
  const n = cov.length;
  let w = equalWeight(n);
  for (let k = 0; k < iterations; k += 1) {
    const sigmaW = mv(cov, w);
    const varP = w.reduce((s, wi, i) => s + wi * sigmaW[i], 0);
    const target = varP / n;
    const next = w.map((wi, i) => {
      const rc = wi * sigmaW[i];
      const scaleI = rc > 1e-18 ? target / rc : 1;
      return Math.max(wi * Math.sqrt(scaleI), 1e-12);
    });
    const sum = next.reduce((s, v) => s + v, 0);
    w = next.map((v) => v / sum);
  }
  return w;
}

export function riskContributions(weights: number[], cov: number[][]): number[] {
  const sigmaW = mv(cov, weights);
  const varP = Math.max(
    weights.reduce((s, w, i) => s + w * sigmaW[i], 0),
    1e-18,
  );
  return weights.map((w, i) => (w * sigmaW[i]) / varP);
}

export function twoFundFrontier(
  mu: number[],
  cov: number[][],
  rf = 0,
  points = 41,
): { weight: number; ret: number; vol: number; sharpe: number }[] {
  const gmv = globalMinVariance(cov);
  const tangency = maxSharpe(mu, cov, rf, false);
  const out: { weight: number; ret: number; vol: number; sharpe: number }[] = [];
  for (let i = 0; i < points; i += 1) {
    const t = -0.4 + (1.6 * i) / (points - 1);
    const w = vecAdd(vecScale(gmv, 1 - t), vecScale(tangency, t));
    const m = portfolioMoments(w, mu, cov, rf);
    out.push({ weight: t, ret: m.expectedReturn, vol: m.volatility, sharpe: m.sharpe });
  }
  return out;
}

export function longOnlyFrontier(
  mu: number[],
  cov: number[][],
  rf = 0,
  points = 21,
): { target: number; weights: number[]; ret: number; vol: number; sharpe: number }[] {
  const gmv = globalMinVariance(cov, true);
  const gmvMu = portfolioMoments(gmv, mu, cov, rf).expectedReturn;
  const maxMu = Math.max(...mu);
  const out: {
    target: number;
    weights: number[];
    ret: number;
    vol: number;
    sharpe: number;
  }[] = [];
  for (let i = 0; i < points; i += 1) {
    const target = gmvMu + ((maxMu - gmvMu) * i) / Math.max(points - 1, 1);
    const w = minVarAtReturn(mu, cov, target);
    const m = portfolioMoments(w, mu, cov, rf);
    out.push({ target, weights: w, ret: m.expectedReturn, vol: m.volatility, sharpe: m.sharpe });
  }
  return out;
}

function minVarAtReturn(
  mu: number[],
  cov: number[][],
  target: number,
  steps = 250,
): number[] {
  const n = mu.length;
  let w = projectSimplex(ones(n).map(() => 1 / n));
  let lr = 0.15;
  for (let k = 0; k < steps; k += 1) {
    const covW = mv(cov, w);
    const ret = w.reduce((s, wi, i) => s + wi * mu[i], 0);
    const grad = covW.map((g, i) => g + 16 * (ret - target) * mu[i]);
    const trial = projectSimplex(vecAdd(w, vecScale(grad, -lr)));
    const varNow = quadratic(w, cov);
    const varNext = quadratic(trial, cov);
    const retNext = trial.reduce((s, wi, i) => s + wi * mu[i], 0);
    const lossNow = varNow + 4 * (ret - target) ** 2;
    const lossNext = varNext + 4 * (retNext - target) ** 2;
    if (lossNext <= lossNow) {
      w = trial;
      lr *= 1.01;
    } else {
      lr *= 0.5;
    }
  }
  return w;
}

export type BlackLittermanView = {
  asset: number;
  q: number;
  confidence: number;
};

/**
 * Black–Litterman posterior expected returns.
 * π = δ Σ w_mkt; P views; Ω diagonal from τ and confidence.
 */
export function blackLitterman(
  cov: number[][],
  marketWeights: number[],
  views: BlackLittermanView[],
  options?: { delta?: number; tau?: number },
): number[] {
  const delta = options?.delta ?? 2.5;
  const tau = options?.tau ?? 0.05;
  const n = cov.length;
  const pi = vecScale(mv(cov, marketWeights), delta);
  if (views.length === 0) return pi;

  const k = views.length;
  const P = Array.from({ length: k }, () => Array.from({ length: n }, () => 0));
  const q = views.map((v) => v.q);
  const omega = Array.from({ length: k }, () =>
    Array.from({ length: k }, () => 0),
  );
  views.forEach((view, r) => {
    P[r][view.asset] = 1;
    const conf = Math.min(Math.max(view.confidence, 0.05), 0.99);
    omega[r][r] = Math.max(tau * cov[view.asset][view.asset] * ((1 - conf) / conf), 1e-12);
  });

  const tauSigma = scale(cov, tau);
  const tauSigmaInv = inverseSPD(tauSigma);
  const omegaInv = inverseSPD(omega);
  const ptOmegaP = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let r = 0; r < k; r += 1) {
        for (let c = 0; c < k; c += 1) {
          s += P[r][i] * omegaInv[r][c] * P[c][j];
        }
      }
      ptOmegaP[i][j] = s;
    }
  }
  const left = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => tauSigmaInv[i][j] + ptOmegaP[i][j]),
  );
  const pOmegaQ = Array.from({ length: n }, () => 0);
  for (let i = 0; i < n; i += 1) {
    let s = 0;
    for (let r = 0; r < k; r += 1) {
      for (let c = 0; c < k; c += 1) {
        s += P[r][i] * omegaInv[r][c] * q[c];
      }
    }
    pOmegaQ[i] = s;
  }
  const rhs = vecAdd(mv(tauSigmaInv, pi), pOmegaQ);
  return solveSPD(left, rhs);
}

export function packAnnual(
  returns: number[][],
): { mu: number[]; cov: number[][]; sample: number[][]; shrink: number } {
  const lw = ledoitWolfShrink(returns);
  return {
    mu: annualizeMu(lw.mu),
    cov: annualizeCov(lw.shrunk),
    sample: annualizeCov(lw.sample),
    shrink: lw.delta,
  };
}

export function resultOf(
  kind: OptimizerKind,
  weights: number[],
  mu: number[],
  cov: number[][],
  rf: number,
): OptimizeResult {
  return { kind, weights, ...portfolioMoments(weights, mu, cov, rf) };
}

export function scaleHoldingsToWeights<T extends { symbol: string; shares: number }>(
  holdings: T[],
  priceOf: (symbol: string) => number,
  weights: Record<string, number>,
): T[] {
  const valued = holdings.map((h) => ({
    h,
    value: h.shares * priceOf(h.symbol),
  }));
  const invested = valued.reduce((s, v) => s + v.value, 0);
  if (invested <= 0) return holdings;
  const bySym = new Map<string, number>();
  for (const row of valued) {
    bySym.set(row.h.symbol, (bySym.get(row.h.symbol) ?? 0) + row.value);
  }
  return holdings.map((h) => {
    const px = priceOf(h.symbol);
    const symVal = bySym.get(h.symbol) ?? 0;
    const target = (weights[h.symbol] ?? 0) * invested;
    const factor = symVal > 1e-9 ? target / symVal : 0;
    return { ...h, shares: px > 0 ? h.shares * factor : 0 };
  });
}
