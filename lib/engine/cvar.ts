import { historicalVaR } from "@/lib/engine/var";
import { projectSimplex, vecAdd, vecScale } from "@/lib/engine/matrix";

function equalWeight(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n);
}

export function portfolioPath(weights: number[], returns: number[][]): number[] {
  return returns.map((row) => weights.reduce((s, w, i) => s + w * (row[i] ?? 0), 0));
}

export function pathCVaR(weights: number[], returns: number[][], alpha = 0.95): number {
  const port = portfolioPath(weights, returns);
  if (port.length < 8) return 0;
  return historicalVaR(port, alpha).cvar;
}

/**
 * Long-only empirical CVaR minimizer.
 * CVaR_α(w) = −E[r | r ≤ −VaR]. Gradient is −E[R_t | tail]; descend on the simplex.
 */
export function minCVaR(returns: number[][], alpha = 0.95, steps = 450): number[] {
  const n = returns[0]?.length ?? 0;
  if (n === 0 || returns.length < 12) return equalWeight(Math.max(n, 1));
  let w = equalWeight(n);
  let lr = 0.2;
  for (let k = 0; k < steps; k += 1) {
    const port = portfolioPath(w, returns);
    const { var: varLoss } = historicalVaR(port, alpha);
    const cutoff = -varLoss;
    const tail: number[] = [];
    for (let t = 0; t < port.length; t += 1) {
      if (port[t]! <= cutoff + 1e-15) tail.push(t);
    }
    if (!tail.length) break;
    const grad = Array.from({ length: n }, () => 0);
    for (const t of tail) {
      const row = returns[t]!;
      for (let i = 0; i < n; i += 1) grad[i]! -= row[i] ?? 0;
    }
    for (let i = 0; i < n; i += 1) grad[i]! /= tail.length;
    const trial = projectSimplex(vecAdd(w, vecScale(grad, -lr)));
    if (pathCVaR(trial, returns, alpha) <= pathCVaR(w, returns, alpha) + 1e-14) {
      w = trial;
      lr *= 1.04;
    } else {
      lr *= 0.5;
    }
    if (lr < 1e-8) break;
  }
  return w;
}
