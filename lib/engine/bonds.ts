/**
 * Zero-coupon analytics under annual compounding.
 * P = (1+y)^{−τ},  D_mod = τ/(1+y),  Conv = τ(τ+1)/(1+y)².
 */

export function zeroPrice(y: number, tau: number): number {
  return (1 + y) ** -tau;
}

export function modifiedDuration(y: number, tau: number): number {
  return tau / (1 + y);
}

export function macaulayDuration(y: number, tau: number): number {
  return tau;
}

export function convexity(y: number, tau: number): number {
  return (tau * (tau + 1)) / (1 + y) ** 2;
}

/** First-order price change: ΔP/P ≈ −D_mod Δy + ½ Conv (Δy)². */
export function priceChange(y: number, tau: number, dy: number): number {
  const p = zeroPrice(y, tau);
  const dP = -modifiedDuration(y, tau) * p * dy + 0.5 * convexity(y, tau) * p * dy * dy;
  return dP / p;
}

export type CurveTenor = { tau: number; yield: number };

/** Value-weighted modified duration of a barbell of zeros (equal face). */
export function curveDuration(points: CurveTenor[]): number {
  if (!points.length) return 0;
  let pv = 0;
  let wD = 0;
  for (const p of points) {
    const y = p.yield > 2 ? p.yield / 100 : p.yield;
    const price = zeroPrice(y, p.tau);
    pv += price;
    wD += price * modifiedDuration(y, p.tau);
  }
  return pv > 0 ? wD / pv : 0;
}

/**
 * Earnings-yield gap (Fed model): 1/PE − y_10.
 * Bond yield may be percent (4.1) or decimal (0.041).
 */
export function earningsYieldGap(pe: number, bondYield: number): number | null {
  if (!(pe > 0)) return null;
  const y = bondYield > 2 ? bondYield / 100 : bondYield;
  return 1 / pe - y;
}

export function curveConvexity(points: CurveTenor[]): number {
  if (!points.length) return 0;
  let pv = 0;
  let wC = 0;
  for (const p of points) {
    const y = p.yield > 2 ? p.yield / 100 : p.yield;
    const price = zeroPrice(y, p.tau);
    pv += price;
    wC += price * convexity(y, p.tau);
  }
  return pv > 0 ? wC / pv : 0;
}
