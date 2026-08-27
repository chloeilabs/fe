export function kellyFraction(mu: number, sigma2: number): number {
  if (sigma2 <= 1e-18) return 0;
  return mu / sigma2;
}

export function kellyGrowth(mu: number, sigma2: number, f: number): number {
  return mu * f - 0.5 * sigma2 * f * f;
}

export function fractionalKelly(
  mu: number,
  sigma2: number,
  fraction = 0.5,
): { f: number; growth: number; full: number } {
  const full = kellyFraction(mu, sigma2);
  const f = full * fraction;
  return { f, growth: kellyGrowth(mu, sigma2, f), full };
}

export function leverageCap(f: number, cap = 1): number {
  return Math.min(Math.max(f, 0), cap);
}
