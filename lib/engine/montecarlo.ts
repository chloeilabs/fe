import { cholesky, mv, scale } from "@/lib/engine/matrix";
import { gaussian, mulberry32, percentile } from "@/lib/engine/stats";

function chiSquare(nu: number, rng: () => number): number {
  let s = 0;
  for (let i = 0; i < nu; i += 1) {
    const z = gaussian(rng);
    s += z * z;
  }
  return s;
}

/**
 * Multivariate Student-t draws: x = μ + L z * sqrt(ν / χ²_ν)
 * with a shared χ² so the copula is elliptical (fat joint tails).
 */
export function studentTDraws(
  mu: number[],
  cov: number[][],
  nu: number,
  n: number,
  seed = 1,
): number[][] {
  const adj = nu > 2 ? (nu - 2) / nu : 1;
  const L = cholesky(scale(cov, adj));
  const rng = mulberry32(seed);
  const dim = mu.length;
  const out: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const z = Array.from({ length: dim }, () => gaussian(rng));
    const scale = Math.sqrt(nu / Math.max(chiSquare(Math.max(Math.round(nu), 3), rng), 1e-12));
    const shock = mv(L, z).map((v) => v * scale);
    out.push(mu.map((m, j) => m + shock[j]));
  }
  return out;
}

export type WealthPathResult = {
  paths: number[][];
  quantiles: { p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[] };
  terminal: { p5: number; p50: number; p95: number; mean: number };
};

export function wealthPaths(args: {
  start: number;
  mu: number[];
  cov: number[][];
  weights: number[];
  years: number;
  stepsPerYear?: number;
  paths?: number;
  nu?: number;
  seed?: number;
}): WealthPathResult {
  const stepsPerYear = args.stepsPerYear ?? 12;
  const nPaths = args.paths ?? 400;
  const nu = args.nu ?? 7;
  const steps = Math.max(1, Math.round(args.years * stepsPerYear));
  const dt = 1 / stepsPerYear;
  const muDt = args.mu.map((m) => m * dt);
  const covDt = args.cov.map((row) => row.map((v) => v * dt));
  const draws = studentTDraws(muDt, covDt, nu, nPaths * steps, args.seed ?? 7);
  const paths: number[][] = [];
  let k = 0;
  for (let p = 0; p < nPaths; p += 1) {
    const path = [args.start];
    let wealth = args.start;
    for (let t = 0; t < steps; t += 1) {
      const r = draws[k++];
      const rp = args.weights.reduce((s, w, i) => s + w * (r[i] ?? 0), 0);
      wealth *= 1 + rp;
      path.push(wealth);
    }
    paths.push(path);
  }
  const len = paths[0].length;
  const slice = (q: number) =>
    Array.from({ length: len }, (_, t) =>
      percentile(
        paths.map((p) => p[t]),
        q,
      ),
    );
  const terminals = paths.map((p) => p[p.length - 1]);
  return {
    paths: paths.slice(0, 24),
    quantiles: {
      p5: slice(0.05),
      p25: slice(0.25),
      p50: slice(0.5),
      p75: slice(0.75),
      p95: slice(0.95),
    },
    terminal: {
      p5: percentile(terminals, 0.05),
      p50: percentile(terminals, 0.5),
      p95: percentile(terminals, 0.95),
      mean: terminals.reduce((s, v) => s + v, 0) / terminals.length,
    },
  };
}
