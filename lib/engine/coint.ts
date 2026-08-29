import { mean } from "@/lib/engine/stats";

export type CointResult = {
  alpha: number;
  beta: number;
  adf: number;
  residualVol: number;
  halfLife: number;
  lastZ: number;
  n: number;
  cointegrated: boolean;
};

function ols(y: number[], x: number[]): { alpha: number; beta: number } {
  const n = Math.min(y.length, x.length);
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    sxx += (x[i]! - mx) ** 2;
    sxy += (x[i]! - mx) * (y[i]! - my);
  }
  const beta = sxx > 1e-18 ? sxy / sxx : 0;
  return { alpha: my - beta * mx, beta };
}

/** Dickey–Fuller t-stat on Δe = γ e_{t−1} + ε (no intercept, no lags). */
export function dickeyFuller(resid: number[]): number {
  if (resid.length < 8) return 0;
  let num = 0;
  let den = 0;
  const de: number[] = [];
  const lag: number[] = [];
  for (let t = 1; t < resid.length; t += 1) {
    de.push(resid[t]! - resid[t - 1]!);
    lag.push(resid[t - 1]!);
  }
  for (let i = 0; i < de.length; i += 1) {
    num += lag[i]! * de[i]!;
    den += lag[i]! * lag[i]!;
  }
  const gamma = den > 1e-18 ? num / den : 0;
  const sse = de.reduce((s, d, i) => s + (d - gamma * lag[i]!) ** 2, 0);
  const se = Math.sqrt(sse / Math.max(de.length - 1, 1) / Math.max(den, 1e-18));
  return se > 0 ? gamma / se : 0;
}

/**
 * Engle–Granger: OLS hedge y = α + β x, then DF on residuals.
 * 5% MacKinnon critical value ≈ −3.34 for a residual-based test with a constant.
 */
export function engleGranger(y: number[], x: number[]): CointResult {
  const n = Math.min(y.length, x.length);
  const { alpha, beta } = ols(y.slice(0, n), x.slice(0, n));
  const resid = y.slice(0, n).map((yi, i) => yi - alpha - beta * x[i]!);
  const adf = dickeyFuller(resid);
  const sse = resid.reduce((s, e) => s + e * e, 0);
  const residualVol = Math.sqrt(sse / Math.max(n - 2, 1));
  let rhoNum = 0;
  let rhoDen = 0;
  for (let t = 1; t < resid.length; t += 1) {
    rhoNum += resid[t - 1]! * resid[t]!;
    rhoDen += resid[t - 1]! * resid[t - 1]!;
  }
  const rho = rhoDen > 1e-18 ? rhoNum / rhoDen : 0;
  const halfLife = rho < 1 && rho > 0 ? Math.log(2) / -Math.log(rho) : Infinity;
  const last = resid[resid.length - 1] ?? 0;
  return {
    alpha,
    beta,
    adf,
    residualVol,
    halfLife,
    lastZ: residualVol > 1e-12 ? last / residualVol : 0,
    n,
    cointegrated: adf < -3.34,
  };
}

export function pairwiseCoint(
  series: Record<string, number[]>,
  names: string[],
): { a: string; b: string; result: CointResult }[] {
  const out: { a: string; b: string; result: CointResult }[] = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const a = names[i]!;
      const b = names[j]!;
      out.push({ a, b, result: engleGranger(series[a] ?? [], series[b] ?? []) });
    }
  }
  return out.sort((p, q) => p.result.adf - q.result.adf);
}

export function logPrices(prices: number[]): number[] {
  return prices.filter((p) => p > 0).map((p) => Math.log(p));
}
