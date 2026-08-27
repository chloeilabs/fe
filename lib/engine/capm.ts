import { mean, stdev, variance } from "@/lib/engine/stats";

export type CapmResult = {
  alpha: number;
  beta: number;
  r2: number;
  residualVol: number;
  trackingError: number;
  informationRatio: number;
  n: number;
};

export function capm(
  asset: number[],
  market: number[],
  rf = 0,
): CapmResult {
  const n = Math.min(asset.length, market.length);
  const y = asset.slice(0, n).map((r) => r - rf);
  const x = market.slice(0, n).map((r) => r - rf);
  if (n < 3) {
    return {
      alpha: 0,
      beta: 1,
      r2: 0,
      residualVol: 0,
      trackingError: 0,
      informationRatio: 0,
      n,
    };
  }
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    sxx += (x[i] - mx) * (x[i] - mx);
    sxy += (x[i] - mx) * (y[i] - my);
  }
  const beta = sxx > 1e-18 ? sxy / sxx : 0;
  const alpha = my - beta * mx;
  const fitted = x.map((xi) => alpha + beta * xi);
  const resid = y.map((yi, i) => yi - fitted[i]);
  const sst = y.reduce((s, yi) => s + (yi - my) ** 2, 0);
  const sse = resid.reduce((s, e) => s + e * e, 0);
  const r2 = sst > 1e-18 ? 1 - sse / sst : 1;
  const residualVol = Math.sqrt(sse / Math.max(n - 2, 1));
  const te = stdev(
    y.map((yi, i) => yi - x[i]),
    true,
  );
  const ir = te > 1e-12 ? mean(y.map((yi, i) => yi - x[i])) / te : 0;
  return {
    alpha,
    beta,
    r2,
    residualVol,
    trackingError: te,
    informationRatio: ir,
    n,
  };
}

export function annualizeAlpha(dailyAlpha: number, periods = 252): number {
  return dailyAlpha * periods;
}

/** Scalar Kalman filter for a time-varying beta. */
export function kalmanBeta(
  asset: number[],
  market: number[],
  processVar = 1e-5,
  obsVar = 1e-4,
): number[] {
  const n = Math.min(asset.length, market.length);
  const betas: number[] = [];
  let beta = 1;
  let p = 1;
  for (let t = 0; t < n; t += 1) {
    p += processVar;
    const x = market[t];
    const k = p * x * (1 / (x * p * x + obsVar));
    beta += k * (asset[t] - beta * x);
    p *= 1 - k * x;
    betas.push(beta);
  }
  return betas;
}

export function treynor(excess: number[], beta: number): number {
  return beta === 0 ? 0 : mean(excess) / beta;
}

export function jensenAlpha(
  asset: number[],
  market: number[],
  rf = 0,
): number {
  return capm(asset, market, rf).alpha;
}

export function sampleVariance(xs: number[]): number {
  return variance(xs, true);
}
