import { mean, variance } from "@/lib/engine/stats";

export type GarchResult = {
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  unconditional: number;
  lastVariance: number;
  forecast: number[];
  logLik: number;
};

function series(omega: number, alpha: number, beta: number, returns: number[], var0: number): {
  vars: number[];
  ll: number;
} {
  const vars = Array.from({ length: returns.length }, () => var0);
  let ll = 0;
  for (let t = 1; t < returns.length; t += 1) {
    vars[t] = omega + alpha * returns[t - 1]! ** 2 + beta * vars[t - 1]!;
    const s2 = Math.max(vars[t]!, 1e-18);
    ll += -0.5 * (Math.log(s2) + returns[t]! ** 2 / s2);
  }
  return { vars, ll };
}

/**
 * GARCH(1,1) with variance targeting: ω = (1 − α − β) σ̄².
 * Quasi-maximum likelihood on a coarse (α, β) grid.
 */
export function fitGarch(returns: number[], horizon = 10): GarchResult {
  const n = returns.length;
  const v = Math.max(variance(returns, true), 1e-12);
  if (n < 20) {
    return {
      omega: v * 0.05,
      alpha: 0.05,
      beta: 0.9,
      persistence: 0.95,
      unconditional: v,
      lastVariance: v,
      forecast: Array.from({ length: horizon }, () => v),
      logLik: 0,
    };
  }
  let best = { alpha: 0.05, beta: 0.9, ll: -Infinity, vars: [v] };
  for (let a = 0.02; a <= 0.2; a += 0.02) {
    for (let b = 0.7; b <= 0.97; b += 0.03) {
      if (a + b >= 0.995) continue;
      const omega = (1 - a - b) * v;
      const { vars, ll } = series(omega, a, b, returns, v);
      if (ll > best.ll) best = { alpha: a, beta: b, ll, vars };
    }
  }
  const omega = (1 - best.alpha - best.beta) * v;
  const last = best.vars[best.vars.length - 1] ?? v;
  const persistence = best.alpha + best.beta;
  const uncond = persistence < 0.999 ? omega / (1 - persistence) : v;
  const forecast: number[] = [];
  let f = last;
  const lastR2 = returns[n - 1]! ** 2;
  f = omega + best.alpha * lastR2 + best.beta * last;
  forecast.push(f);
  for (let h = 1; h < horizon; h += 1) {
    f = uncond + persistence ** h * (forecast[0]! - uncond);
    forecast.push(f);
  }
  return {
    omega,
    alpha: best.alpha,
    beta: best.beta,
    persistence,
    unconditional: uncond,
    lastVariance: last,
    forecast,
    logLik: best.ll,
  };
}

export function garchStep(
  omega: number,
  alpha: number,
  beta: number,
  prevReturn: number,
  prevVar: number,
): number {
  return omega + alpha * prevReturn * prevReturn + beta * prevVar;
}

export function annualizeVariance(dailyVar: number, periods = 252): number {
  return dailyVar * periods;
}

export function meanAbsReturn(returns: number[]): number {
  return mean(returns.map((r) => Math.abs(r)));
}
