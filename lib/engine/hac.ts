import { olsMulti } from "@/lib/engine/factors";
import { inverseSPD, multiply, transpose, zeros } from "@/lib/engine/matrix";

/** Bartlett kernel: 1 − ℓ/(L+1). */
export function bartlett(lag: number, maxLag: number): number {
  if (maxLag <= 0) return lag === 0 ? 1 : 0;
  return Math.max(1 - lag / (maxLag + 1), 0);
}

export type NeweyWestResult = {
  beta: number[];
  se: number[];
  lags: number;
  n: number;
};

/**
 * Newey–West HAC standard errors for OLS y = Xβ + ε.
 * Meat = Γ₀ + Σ_ℓ w_ℓ (Γ_ℓ + Γ_ℓ′),  V = (X′X)⁻¹ Meat (X′X)⁻¹.
 */
export function neweyWest(y: number[], X: number[][], maxLag?: number): NeweyWestResult {
  const n = Math.min(y.length, X.length);
  const k = X[0]?.length ?? 0;
  if (n < k || k === 0) {
    return { beta: Array.from({ length: Math.max(k, 1) }, () => 0), se: Array.from({ length: Math.max(k, 1) }, () => 0), lags: 0, n };
  }
  const rows = X.slice(0, n);
  const yy = y.slice(0, n);
  const { beta } = olsMulti(yy, rows);
  const resid = yy.map((yi, t) => yi - rows[t]!.reduce((s, x, j) => s + x * (beta[j] ?? 0), 0));
  const L = maxLag ?? Math.max(0, Math.floor(Math.cbrt(n)));

  const gamma = (lag: number) => {
    const G = zeros(k);
    for (let t = lag; t < n; t += 1) {
      const a = resid[t]! * resid[t - lag]!;
      for (let i = 0; i < k; i += 1) {
        for (let j = 0; j < k; j += 1) {
          G[i]![j]! += a * rows[t]![i]! * rows[t - lag]![j]!;
        }
      }
    }
    return G;
  };

  const meat = gamma(0);
  for (let lag = 1; lag <= L; lag += 1) {
    const G = gamma(lag);
    const w = bartlett(lag, L);
    for (let i = 0; i < k; i += 1) {
      for (let j = 0; j < k; j += 1) {
        meat[i]![j]! += w * (G[i]![j]! + G[j]![i]!);
      }
    }
  }

  const xtxInv = inverseSPD(multiply(transpose(rows), rows));
  const V = multiply(multiply(xtxInv, meat), xtxInv);
  return {
    beta,
    se: V.map((row, i) => Math.sqrt(Math.max(row[i] ?? 0, 0))),
    lags: L,
    n,
  };
}

export function capmNeweyWest(
  asset: number[],
  market: number[],
  rf = 0,
  maxLag?: number,
): { alpha: number; beta: number; seAlpha: number; seBeta: number; tAlpha: number; tBeta: number; lags: number } {
  const n = Math.min(asset.length, market.length);
  const y = asset.slice(0, n).map((r) => r - rf);
  const X = market.slice(0, n).map((r) => [1, r - rf]);
  const nw = neweyWest(y, X, maxLag);
  const alpha = nw.beta[0] ?? 0;
  const beta = nw.beta[1] ?? 0;
  const seAlpha = nw.se[0] ?? 0;
  const seBeta = nw.se[1] ?? 0;
  return {
    alpha,
    beta,
    seAlpha,
    seBeta,
    tAlpha: seAlpha > 1e-18 ? alpha / seAlpha : 0,
    tBeta: seBeta > 1e-18 ? beta / seBeta : 0,
    lags: nw.lags,
  };
}
