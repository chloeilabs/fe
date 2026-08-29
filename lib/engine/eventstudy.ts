import { sortedBars, type PriceBar } from "@/lib/engine/risk";

export type CarPoint = {
  date: string;
  car: number;
  ar0: number;
  n: number;
};

function alignedPair(
  asset: PriceBar[],
  market: PriceBar[],
): { dates: string[]; ar: number[]; assetR: number[]; mktR: number[] } {
  const a = new Map(sortedBars(asset).map((b) => [b.date, b.price]));
  const m = new Map(sortedBars(market).map((b) => [b.date, b.price]));
  const dates = [...a.keys()].filter((d) => m.has(d)).sort();
  const assetR: number[] = [];
  const mktR: number[] = [];
  const ar: number[] = [];
  const retDates: string[] = [];
  for (let i = 1; i < dates.length; i += 1) {
    const prev = dates[i - 1]!;
    const next = dates[i]!;
    const a0 = a.get(prev)!;
    const a1 = a.get(next)!;
    const m0 = m.get(prev)!;
    const m1 = m.get(next)!;
    if (a0 <= 0 || m0 <= 0) continue;
    const ra = a1 / a0 - 1;
    const rm = m1 / m0 - 1;
    assetR.push(ra);
    mktR.push(rm);
    ar.push(ra - rm);
    retDates.push(next);
  }
  return { dates: retDates, ar, assetR, mktR };
}

/**
 * Market-adjusted CAR on [−pre, +post] trading days around each event date.
 * AR_t = r_i,t − r_m,t. Event day is the first return date ≥ the announcement.
 */
export function earningsCars(
  asset: PriceBar[],
  market: PriceBar[],
  eventDates: string[],
  pre = 1,
  post = 1,
): CarPoint[] {
  const { dates, ar } = alignedPair(asset, market);
  const out: CarPoint[] = [];
  for (const raw of eventDates) {
    const day = raw.slice(0, 10);
    let idx = dates.findIndex((d) => d >= day);
    if (idx < 0) continue;
    const lo = Math.max(0, idx - pre);
    const hi = Math.min(ar.length - 1, idx + post);
    if (hi < lo) continue;
    let car = 0;
    let ar0 = 0;
    let n = 0;
    for (let t = lo; t <= hi; t += 1) {
      car += ar[t]!;
      n += 1;
      if (t === idx) ar0 = ar[t]!;
    }
    out.push({ date: day, car, ar0, n });
  }
  return out;
}

export function meanCar(points: CarPoint[]): number {
  if (!points.length) return 0;
  return points.reduce((s, p) => s + p.car, 0) / points.length;
}

/** t-stat of mean CAR under i.i.d. events (se = s / √n). */
export function carTStat(points: CarPoint[]): { mean: number; se: number; t: number; n: number } {
  const n = points.length;
  if (!n) return { mean: 0, se: 0, t: 0, n: 0 };
  const m = meanCar(points);
  if (n < 2) return { mean: m, se: 0, t: 0, n };
  const sse = points.reduce((s, p) => s + (p.car - m) ** 2, 0);
  const se = Math.sqrt(sse / (n - 1) / n);
  return { mean: m, se, t: se > 1e-18 ? m / se : 0, n };
}
