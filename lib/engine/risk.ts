import { correlation, covariance, mean, stdev } from "./stats";

export type PriceBar = { date: string; price: number };

export function sortedBars(bars: PriceBar[]): PriceBar[] {
  return [...bars].filter((b) => Number.isFinite(b.price) && b.price > 0).sort((a, b) => a.date.localeCompare(b.date));
}

export function simpleReturns(bars: PriceBar[]): number[] {
  const ordered = sortedBars(bars);
  const out: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!.price;
    const next = ordered[i]!.price;
    if (prev > 0) out.push(next / prev - 1);
  }
  return out;
}

export function alignedReturns(series: Record<string, PriceBar[]>): {
  dates: string[];
  returns: Record<string, number[]>;
} {
  const symbols = Object.keys(series);
  if (symbols.length === 0) return { dates: [], returns: {} };
  const maps = Object.fromEntries(
    symbols.map((s) => [s, new Map(sortedBars(series[s] ?? []).map((b) => [b.date, b.price]))]),
  ) as Record<string, Map<string, number>>;
  const dateSets = symbols.map((s) => new Set(maps[s]!.keys()));
  const dates = [...dateSets[0]!].filter((d) => dateSets.every((set) => set.has(d))).sort();
  const returns: Record<string, number[]> = Object.fromEntries(symbols.map((s) => [s, []]));
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1]!;
    const next = dates[i]!;
    for (const s of symbols) {
      const p0 = maps[s]!.get(prev)!;
      const p1 = maps[s]!.get(next)!;
      returns[s]!.push(p1 / p0 - 1);
    }
  }
  return { dates: dates.slice(1), returns };
}

export function portfolioReturns(weights: Record<string, number>, assetReturns: Record<string, number[]>): number[] {
  const symbols = Object.keys(weights);
  const n = Math.min(...symbols.map((s) => assetReturns[s]?.length ?? 0));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (const s of symbols) r += (weights[s] ?? 0) * (assetReturns[s]?.[i] ?? 0);
    out.push(r);
  }
  return out;
}

export function annualizedReturn(dailyReturns: number[]) {
  if (dailyReturns.length === 0) return 0;
  return mean(dailyReturns) * 252;
}

export function annualizedVol(dailyReturns: number[]) {
  if (dailyReturns.length < 2) return 0;
  return stdev(dailyReturns) * Math.sqrt(252);
}

export function sharpeRatio(dailyReturns: number[], annualRiskFree = 0.04) {
  const vol = annualizedVol(dailyReturns);
  if (vol === 0) return 0;
  return (annualizedReturn(dailyReturns) - annualRiskFree) / vol;
}

export function sortinoRatio(dailyReturns: number[], annualRiskFree = 0.04) {
  const rfDaily = annualRiskFree / 252;
  const downside = dailyReturns.filter((r) => r < rfDaily).map((r) => r - rfDaily);
  if (downside.length < 2) return 0;
  const dd = stdev(downside, false) * Math.sqrt(252);
  if (dd === 0) return 0;
  return (annualizedReturn(dailyReturns) - annualRiskFree) / dd;
}

export function maxDrawdown(bars: PriceBar[]): { maxDrawdown: number; peakDate: string; troughDate: string } {
  const ordered = sortedBars(bars);
  let peak = -Infinity;
  let peakDate = "";
  let maxDd = 0;
  let troughDate = "";
  let peakAtMax = "";
  for (const bar of ordered) {
    if (bar.price > peak) {
      peak = bar.price;
      peakDate = bar.date;
    }
    const dd = peak > 0 ? bar.price / peak - 1 : 0;
    if (dd < maxDd) {
      maxDd = dd;
      troughDate = bar.date;
      peakAtMax = peakDate;
    }
  }
  return { maxDrawdown: maxDd, peakDate: peakAtMax, troughDate };
}

export function betaVsMarket(assetReturns: number[], marketReturns: number[]) {
  const v = covariance(assetReturns, marketReturns);
  const mvar = covariance(marketReturns, marketReturns);
  if (mvar === 0) return 0;
  return v / mvar;
}

export function herfindahl(weights: number[]) {
  return weights.reduce((sum, w) => sum + w * w, 0);
}

export function effectiveN(weights: number[]) {
  const hhi = herfindahl(weights);
  return hhi > 0 ? 1 / hhi : 0;
}

export function correlationMatrix(assetReturns: Record<string, number[]>): {
  symbols: string[];
  matrix: number[][];
} {
  const symbols = Object.keys(assetReturns);
  const matrix = symbols.map((a) => symbols.map((b) => correlation(assetReturns[a] ?? [], assetReturns[b] ?? [])));
  return { symbols, matrix };
}

export function wealthIndex(dailyReturns: number[], start = 1): number[] {
  const out = [start];
  for (const r of dailyReturns) out.push(out[out.length - 1]! * (1 + r));
  return out;
}

export function calmarRatio(dailyReturns: number[], bars: PriceBar[]) {
  const dd = Math.abs(maxDrawdown(bars).maxDrawdown);
  if (dd === 0) return 0;
  return annualizedReturn(dailyReturns) / dd;
}
