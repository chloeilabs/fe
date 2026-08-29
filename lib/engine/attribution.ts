export type BrinsonResult = {
  allocation: number;
  selection: number;
  interaction: number;
  active: number;
  portfolio: number;
  benchmark: number;
};

/**
 * Brinson–Fachler: R_p − R_b = Σ(w_p − w_b) R_b + Σ w_b (R_p − R_b) + Σ(w_p − w_b)(R_p − R_b)
 */
export function brinsonFachler(
  wP: number[],
  wB: number[],
  rP: number[],
  rB: number[],
): BrinsonResult {
  const n = Math.min(wP.length, wB.length, rP.length, rB.length);
  let allocation = 0;
  let selection = 0;
  let interaction = 0;
  let portfolio = 0;
  let benchmark = 0;
  for (let i = 0; i < n; i += 1) {
    const dw = wP[i]! - wB[i]!;
    const dr = rP[i]! - rB[i]!;
    allocation += dw * rB[i]!;
    selection += wB[i]! * dr;
    interaction += dw * dr;
    portfolio += wP[i]! * rP[i]!;
    benchmark += wB[i]! * rB[i]!;
  }
  return {
    allocation,
    selection,
    interaction,
    active: allocation + selection + interaction,
    portfolio,
    benchmark,
  };
}

export function returnContribution(weights: number[], assetReturns: number[]): number[] {
  return weights.map((w, i) => w * (assetReturns[i] ?? 0));
}

/** Compound simple returns over a window: Π(1+r) − 1. */
export function compoundReturn(returns: number[]): number {
  return returns.reduce((wealth, r) => wealth * (1 + r), 1) - 1;
}

export function trailingCompound(returns: number[], window: number): number {
  if (!returns.length || window <= 0) return 0;
  return compoundReturn(returns.slice(-window));
}

/** Policy proxies for class-level Brinson when a sleeve has no dedicated benchmark series. */
export const CLASS_PROXIES: Record<string, string | null> = {
  "us-equity": "VTI",
  "intl-equity": "VXUS",
  bond: "BND",
  cash: null,
  crypto: null,
  reit: "VNQ",
  other: null,
};

export type ClassBrinsonSlice = {
  id: string;
  wP: number;
  wB: number;
  rP: number;
  rB: number;
};

export function brinsonFromSlices(slices: ClassBrinsonSlice[]): BrinsonResult {
  return brinsonFachler(
    slices.map((s) => s.wP),
    slices.map((s) => s.wB),
    slices.map((s) => s.rP),
    slices.map((s) => s.rB),
  );
}

export type SuePoint = {
  date: string;
  surprise: number;
  sue: number;
};

/** Standardized unexpected earnings: (A − E) / σ of the surprise series. */
export function standardizedSurprises(
  rows: { date: string; actual: number | null; estimate: number | null }[],
): SuePoint[] {
  const usable = rows.filter(
    (r): r is { date: string; actual: number; estimate: number } =>
      r.actual != null && r.estimate != null && Number.isFinite(r.actual) && Number.isFinite(r.estimate),
  );
  const surprises = usable.map((r) => r.actual - r.estimate);
  const m = surprises.reduce((s, v) => s + v, 0) / Math.max(surprises.length, 1);
  const v =
    surprises.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(surprises.length - 1, 1);
  const sd = Math.sqrt(Math.max(v, 1e-18));
  return usable.map((r, i) => ({
    date: r.date,
    surprise: surprises[i]!,
    sue: surprises[i]! / sd,
  }));
}
