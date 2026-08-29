import { mean } from "@/lib/engine/stats";
import { multiply, mv, solveSPD, transpose } from "@/lib/engine/matrix";

export type FactorResult = {
  alpha: number;
  mkt: number;
  smb: number;
  hml: number;
  r2: number;
  residualVol: number;
  n: number;
};

export function olsMulti(y: number[], X: number[][]): { beta: number[]; r2: number; n: number } {
  const n = Math.min(y.length, X.length);
  const k = X[0]?.length ?? 0;
  if (n < k + 2 || k === 0) {
    return { beta: Array.from({ length: Math.max(k, 1) }, () => 0), r2: 0, n };
  }
  const rows = X.slice(0, n);
  const yy = y.slice(0, n);
  const xt = transpose(rows);
  const xtx = multiply(xt, rows);
  for (let i = 0; i < k; i += 1) xtx[i]![i]! += 1e-10;
  const xty = mv(xt, yy);
  const beta = solveSPD(xtx, xty);
  const fitted = rows.map((row) => row.reduce((s, x, i) => s + x * (beta[i] ?? 0), 0));
  const my = mean(yy);
  const sst = yy.reduce((s, v) => s + (v - my) ** 2, 0);
  const sse = yy.reduce((s, v, i) => s + (v - fitted[i]!) ** 2, 0);
  return { beta, r2: sst > 1e-18 ? 1 - sse / sst : 1, n };
}

/** Daily Fama–French 3-factor OLS: r − r_f = α + β_m MKT + β_s SMB + β_h HML + ε. */
export function famaFrench3(
  asset: number[],
  mkt: number[],
  smb: number[],
  hml: number[],
  rfDaily = 0,
): FactorResult {
  const n = Math.min(asset.length, mkt.length, smb.length, hml.length);
  const y = asset.slice(0, n).map((r) => r - rfDaily);
  const X = Array.from({ length: n }, (_, t) => [1, mkt[t]! - rfDaily, smb[t]!, hml[t]!]);
  const { beta, r2 } = olsMulti(y, X);
  const fitted = X.map((row) => row.reduce((s, x, i) => s + x * (beta[i] ?? 0), 0));
  const sse = y.reduce((s, v, i) => s + (v - fitted[i]!) ** 2, 0);
  return {
    alpha: beta[0] ?? 0,
    mkt: beta[1] ?? 0,
    smb: beta[2] ?? 0,
    hml: beta[3] ?? 0,
    r2,
    residualVol: Math.sqrt(sse / Math.max(n - 4, 1)),
    n,
  };
}

export function makeSmb(small: number[], large: number[]): number[] {
  const n = Math.min(small.length, large.length);
  return Array.from({ length: n }, (_, i) => small[i]! - large[i]!);
}

export function makeHml(value: number[], growth: number[]): number[] {
  return makeSmb(value, growth);
}

export function annualizeAlphaDaily(a: number, periods = 252): number {
  return a * periods;
}
