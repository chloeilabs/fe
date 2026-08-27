export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function variance(values: number[], sample = true): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const denom = sample ? values.length - 1 : values.length;
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / denom;
}

export function stdev(values: number[], sample = true): number {
  return Math.sqrt(variance(values, sample));
}

export function covariance(a: number[], b: number[], sample = true): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const aa = a.slice(0, n);
  const bb = b.slice(0, n);
  const ma = mean(aa);
  const mb = mean(bb);
  const denom = sample ? n - 1 : n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (aa[i] - ma) * (bb[i] - mb);
  return sum / denom;
}

export function correlation(a: number[], b: number[]): number {
  const cov = covariance(a, b);
  const sa = stdev(a);
  const sb = stdev(b);
  if (sa === 0 || sb === 0) return 0;
  return cov / (sa * sb);
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng: () => number = Math.random) {
  const u = Math.max(rng(), Number.EPSILON);
  const v = Math.max(rng(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
