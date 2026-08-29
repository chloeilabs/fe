/**
 * Close-to-close and range-based realized variance (annualized with √252).
 * Parkinson, Garman–Klass, Rogers–Satchell, Yang–Zhang; Amihud illiquidity.
 */

export type OhlcBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export function sortedOhlc(bars: OhlcBar[]): OhlcBar[] {
  return [...bars].filter((b) => b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0).sort((a, b) => a.date.localeCompare(b.date));
}

export function closeToCloseVar(bars: OhlcBar[]): number {
  const s = sortedOhlc(bars);
  if (s.length < 3) return 0;
  const r: number[] = [];
  for (let i = 1; i < s.length; i += 1) {
    r.push(Math.log(s[i]!.close / s[i - 1]!.close));
  }
  const m = r.reduce((a, x) => a + x, 0) / r.length;
  return r.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(r.length - 1, 1);
}

/** σ² = E[ln(H/L)²] / (4 ln 2). */
export function parkinsonVar(bars: OhlcBar[]): number {
  const s = sortedOhlc(bars);
  if (!s.length) return 0;
  const acc = s.reduce((a, b) => a + Math.log(b.high / b.low) ** 2, 0);
  return acc / s.length / (4 * Math.log(2));
}

/** ½ ln(H/L)² − (2 ln 2 − 1) ln(C/O)². */
export function garmanKlassVar(bars: OhlcBar[]): number {
  const s = sortedOhlc(bars);
  if (!s.length) return 0;
  const k = 2 * Math.log(2) - 1;
  const acc = s.reduce((a, b) => {
    const hl = Math.log(b.high / b.low);
    const co = Math.log(b.close / b.open);
    return a + 0.5 * hl * hl - k * co * co;
  }, 0);
  return acc / s.length;
}

/** ln(H/C) ln(H/O) + ln(L/C) ln(L/O). Drift-independent. */
export function rogersSatchellVar(bars: OhlcBar[]): number {
  const s = sortedOhlc(bars);
  if (!s.length) return 0;
  const acc = s.reduce((a, b) => {
    return a + Math.log(b.high / b.close) * Math.log(b.high / b.open) + Math.log(b.low / b.close) * Math.log(b.low / b.open);
  }, 0);
  return acc / s.length;
}

/**
 * Yang–Zhang: overnight + k·open-to-close + (1−k)·RS.
 * k = 0.34 / (1.34 + (n+1)/(n−1)).
 */
export function yangZhangVar(bars: OhlcBar[]): number {
  const s = sortedOhlc(bars);
  if (s.length < 3) return 0;
  const n = s.length - 1;
  const overnight: number[] = [];
  const oc: number[] = [];
  for (let i = 1; i < s.length; i += 1) {
    overnight.push(Math.log(s[i]!.open / s[i - 1]!.close));
    oc.push(Math.log(s[i]!.close / s[i]!.open));
  }
  const mo = overnight.reduce((a, x) => a + x, 0) / overnight.length;
  const mc = oc.reduce((a, x) => a + x, 0) / oc.length;
  const varO = overnight.reduce((a, x) => a + (x - mo) ** 2, 0) / Math.max(n - 1, 1);
  const varC = oc.reduce((a, x) => a + (x - mc) ** 2, 0) / Math.max(n - 1, 1);
  const k = 0.34 / (1.34 + (n + 1) / Math.max(n - 1, 1));
  return varO + k * varC + (1 - k) * rogersSatchellVar(s.slice(1));
}

export function annualizeVar(v: number, periods = 252): number {
  return Math.sqrt(Math.max(v, 0) * periods);
}

/** Amihud (2002): mean |r| / dollar volume. */
export function amihudIlliquidity(bars: OhlcBar[]): number {
  const s = sortedOhlc(bars);
  if (s.length < 2) return 0;
  const pts: number[] = [];
  for (let i = 1; i < s.length; i += 1) {
    const vol = s[i]!.volume ?? 0;
    const dollar = s[i]!.close * vol;
    if (dollar <= 0) continue;
    pts.push(Math.abs(s[i]!.close / s[i - 1]!.close - 1) / dollar);
  }
  if (!pts.length) return 0;
  return pts.reduce((a, x) => a + x, 0) / pts.length;
}

/** 12–1 skip-month momentum: P_{t−21} / P_{t−252} − 1. */
export function skipMonthMomentum(prices: { date: string; price: number }[]): number | null {
  const s = [...prices].filter((p) => p.price > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 253) return null;
  const recent = s[s.length - 1 - 21];
  const old = s[s.length - 1 - 252];
  if (!recent || !old || old.price <= 0) return null;
  return recent.price / old.price - 1;
}

/**
 * Roll (1984) implied relative spread: 2 √(−cov(r_t, r_{t−1})).
 * Zero when serial covariance is non-negative (no bid–ask bounce).
 */
export function rollImpliedSpread(returns: number[]): number {
  if (returns.length < 3) return 0;
  const n = returns.length;
  let mean = 0;
  for (const r of returns) mean += r;
  mean /= n;
  let cov = 0;
  for (let i = 1; i < n; i += 1) {
    cov += (returns[i]! - mean) * (returns[i - 1]! - mean);
  }
  cov /= n - 1;
  if (cov >= 0) return 0;
  return 2 * Math.sqrt(-cov);
}

export function realizedBundle(bars: OhlcBar[]) {
  return {
    close: annualizeVar(closeToCloseVar(bars)),
    parkinson: annualizeVar(parkinsonVar(bars)),
    garmanKlass: annualizeVar(garmanKlassVar(bars)),
    rogersSatchell: annualizeVar(rogersSatchellVar(bars)),
    yangZhang: annualizeVar(yangZhangVar(bars)),
    amihud: amihudIlliquidity(bars),
    n: sortedOhlc(bars).length,
  };
}
