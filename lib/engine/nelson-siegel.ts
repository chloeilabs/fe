/**
 * Nelson–Siegel spot curve.
 * y(τ) = β0 + β1 (1 − e^{−τ/λ})/(τ/λ) + β2 [(1 − e^{−τ/λ})/(τ/λ) − e^{−τ/λ}]
 * Diebold–Li: grid λ, OLS on the loadings.
 */
export type NsFit = {
  beta0: number;
  beta1: number;
  beta2: number;
  lambda: number;
  rmse: number;
  fitted: number[];
};

export function nsLoadings(tau: number, lambda: number): [number, number, number] {
  if (tau < 1e-8) return [1, 1, 0];
  const x = tau / lambda;
  const l1 = (1 - Math.exp(-x)) / x;
  const l2 = l1 - Math.exp(-x);
  return [1, l1, l2];
}

export function nsYield(
  tau: number,
  beta0: number,
  beta1: number,
  beta2: number,
  lambda: number,
): number {
  const [l0, l1, l2] = nsLoadings(tau, lambda);
  return l0 * beta0 + l1 * beta1 + l2 * beta2;
}

function ols3(X: number[][], y: number[]): [number, number, number] {
  const xtx = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const xty = [0, 0, 0];
  for (let i = 0; i < y.length; i += 1) {
    const row = X[i]!;
    for (let a = 0; a < 3; a += 1) {
      xty[a]! += row[a]! * y[i]!;
      for (let b = 0; b < 3; b += 1) xtx[a]![b]! += row[a]! * row[b]!;
    }
  }
  for (let i = 0; i < 3; i += 1) xtx[i]![i]! += 1e-10;
  const n = 3;
  const A = xtx.map((r) => [...r]);
  const x = [...xty];
  for (let i = 0; i < n; i += 1) {
    let piv = i;
    for (let r = i + 1; r < n; r += 1) if (Math.abs(A[r]![i]!) > Math.abs(A[piv]![i]!)) piv = r;
    [A[i], A[piv]] = [A[piv]!, A[i]!];
    [x[i], x[piv]] = [x[piv]!, x[i]!];
    const d = A[i]![i]!;
    for (let c = i; c < n; c += 1) A[i]![c]! /= d;
    x[i]! /= d;
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const f = A[r]![i]!;
      for (let c = i; c < n; c += 1) A[r]![c]! -= f * A[i]![c]!;
      x[r]! -= f * x[i]!;
    }
  }
  return [x[0]!, x[1]!, x[2]!];
}

export const NS_TENORS_YEARS = [1 / 12, 1 / 4, 1 / 2, 1, 2, 3, 5, 7, 10, 20, 30];

export function fitNelsonSiegel(tenors: number[], yields: number[]): NsFit {
  const n = Math.min(tenors.length, yields.length);
  const t = tenors.slice(0, n);
  const y = yields.slice(0, n);
  let best: NsFit | null = null;
  for (let lambda = 0.3; lambda <= 4; lambda += 0.15) {
    const X = t.map((tau) => nsLoadings(tau, lambda));
    const [beta0, beta1, beta2] = ols3(X, y);
    const fitted = t.map((tau) => nsYield(tau, beta0, beta1, beta2, lambda));
    const rmse = Math.sqrt(
      fitted.reduce((s, f, i) => s + (f - y[i]!) ** 2, 0) / Math.max(n, 1),
    );
    if (!best || rmse < best.rmse) {
      best = { beta0, beta1, beta2, lambda, rmse, fitted };
    }
  }
  return best ?? { beta0: y[0] ?? 0, beta1: 0, beta2: 0, lambda: 1.37, rmse: 0, fitted: y };
}

export function curvePoints(
  fit: NsFit,
  tenors = NS_TENORS_YEARS,
): { tau: number; yield: number }[] {
  return tenors.map((tau) => ({ tau, yield: nsYield(tau, fit.beta0, fit.beta1, fit.beta2, fit.lambda) }));
}

export function durationNs(tau: number, y: number): number {
  if (Math.abs(y) < 1e-8) return tau;
  return (1 - 1 / (1 + y) ** tau) / y;
}

export type TreasuryLike = {
  month1?: number;
  month2?: number;
  month3?: number;
  month6?: number;
  year1?: number;
  year2?: number;
  year3?: number;
  year5?: number;
  year7?: number;
  year10?: number;
  year20?: number;
  year30?: number;
};

/** Map an FMP treasury-rates row (yields in percent) onto (τ, y) for Nelson–Siegel. */
export function treasuryToCurve(row: TreasuryLike): { tau: number; yield: number; tenor: string }[] {
  const pairs: { tenor: string; tau: number; yield?: number }[] = [
    { tenor: "1M", tau: 1 / 12, yield: row.month1 },
    { tenor: "2M", tau: 2 / 12, yield: row.month2 },
    { tenor: "3M", tau: 0.25, yield: row.month3 },
    { tenor: "6M", tau: 0.5, yield: row.month6 },
    { tenor: "1Y", tau: 1, yield: row.year1 },
    { tenor: "2Y", tau: 2, yield: row.year2 },
    { tenor: "3Y", tau: 3, yield: row.year3 },
    { tenor: "5Y", tau: 5, yield: row.year5 },
    { tenor: "7Y", tau: 7, yield: row.year7 },
    { tenor: "10Y", tau: 10, yield: row.year10 },
    { tenor: "20Y", tau: 20, yield: row.year20 },
    { tenor: "30Y", tau: 30, yield: row.year30 },
  ];
  return pairs
    .filter((p): p is { tenor: string; tau: number; yield: number } => p.yield != null && Number.isFinite(p.yield))
    .map((p) => ({ tau: p.tau, yield: p.yield, tenor: p.tenor }));
}
