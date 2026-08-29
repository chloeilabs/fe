export type SegmentShare = {
  name: string;
  value: number;
  weight: number;
};

/** Herfindahl–Hirschman: Σ w_i² on a simplex. */
export function herfindahl(values: number[]): number {
  const xs = values.filter((v) => v > 0);
  const tot = xs.reduce((s, v) => s + v, 0);
  if (tot <= 0) return 0;
  return xs.reduce((s, v) => s + (v / tot) ** 2, 0);
}

/** Inverse HHI = equivalent number of equal-sized segments. */
export function effectiveSegments(hhi: number): number {
  return hhi > 1e-18 ? 1 / hhi : 0;
}

export function segmentShares(data: Record<string, number> | null | undefined): SegmentShare[] {
  if (!data) return [];
  const rows = Object.entries(data)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0)
    .sort((a, b) => b.value - a.value);
  const tot = rows.reduce((s, r) => s + r.value, 0);
  if (tot <= 0) return [];
  return rows.map((r) => ({ ...r, weight: r.value / tot }));
}

export function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return (end / start) ** (1 / years) - 1;
}

/** Calendar years between ISO dates. */
export function yearsBetween(from: string, to: string): number {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / (365.25 * 86400000);
}
