import { mean, percentile, stdev } from "@/lib/engine/stats";

/** Peter Acklam's inverse normal CDF approximation. */
export function invNorm(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577509590705e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = stdev(xs, true);
  if (s < 1e-18) return 0;
  const m3 = xs.reduce((acc, x) => acc + (x - m) ** 3, 0) / n;
  return m3 / s ** 3;
}

export function excessKurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return 0;
  const m = mean(xs);
  const s = stdev(xs, true);
  if (s < 1e-18) return 0;
  const m4 = xs.reduce((acc, x) => acc + (x - m) ** 4, 0) / n;
  return m4 / s ** 4 - 3;
}

export type VaRResult = {
  var: number;
  cvar: number;
  mean: number;
  vol: number;
  skew: number;
  exkurt: number;
};

export function historicalVaR(
  returns: number[],
  alpha = 0.95,
): VaRResult {
  const sorted = [...returns].sort((a, b) => a - b);
  const q = 1 - alpha;
  const cutoff = percentile(sorted, q);
  const tail = sorted.filter((r) => r <= cutoff);
  const cvar = tail.length ? mean(tail) : cutoff;
  return {
    var: -cutoff,
    cvar: -cvar,
    mean: mean(returns),
    vol: stdev(returns, true),
    skew: skewness(returns),
    exkurt: excessKurtosis(returns),
  };
}

export function parametricVaR(
  returns: number[],
  alpha = 0.95,
): VaRResult {
  const m = mean(returns);
  const s = stdev(returns, true);
  const z = invNorm(1 - alpha);
  const cutoff = m + s * z;
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cvarCutoff = m - s * (pdf / (1 - alpha));
  return {
    var: -cutoff,
    cvar: -cvarCutoff,
    mean: m,
    vol: s,
    skew: skewness(returns),
    exkurt: excessKurtosis(returns),
  };
}

/** Cornish–Fisher VaR using sample skew and excess kurtosis. */
export function cornishFisherVaR(
  returns: number[],
  alpha = 0.95,
): VaRResult {
  const m = mean(returns);
  const s = stdev(returns, true);
  const g1 = skewness(returns);
  const g2 = excessKurtosis(returns);
  const z = invNorm(1 - alpha);
  const zcf =
    z +
    (g1 / 6) * (z * z - 1) +
    (g2 / 24) * (z ** 3 - 3 * z) -
    (g1 * g1 / 36) * (2 * z ** 3 - 5 * z);
  const cutoff = m + s * zcf;
  const hist = historicalVaR(returns, alpha);
  return {
    var: -cutoff,
    cvar: hist.cvar,
    mean: m,
    vol: s,
    skew: g1,
    exkurt: g2,
  };
}

export function dollarVaR(lossReturn: number, notional: number): number {
  return lossReturn * notional;
}
