import {
  equalWeight,
  globalMinVariance,
  maxSharpe,
  packAnnual,
  riskParity,
} from "@/lib/engine/optimize";

export type WalkForwardPoint = {
  t: number;
  ew: number;
  gmv: number;
  sharpe: number;
  erc: number;
};

export type WalkForwardResult = {
  points: WalkForwardPoint[];
  terminal: { ew: number; gmv: number; sharpe: number; erc: number };
};

/**
 * Expanding-window walk-forward: at each t, fit on [t−lookback, t),
 * apply weights to the next daily return. Wealth starts at 1.
 */
export function walkForward(
  returns: number[][],
  lookback = 60,
  rfAnnual = 0.043,
): WalkForwardResult {
  const T = returns.length;
  const N = returns[0]?.length ?? 0;
  const points: WalkForwardPoint[] = [];
  let ew = 1;
  let gmvW = 1;
  let sh = 1;
  let erc = 1;
  if (T <= lookback + 2 || N === 0) {
    return { points, terminal: { ew, gmv: gmvW, sharpe: sh, erc } };
  }
  const rf = rfAnnual / 252;
  for (let t = lookback; t < T; t += 1) {
    const window = returns.slice(t - lookback, t);
    const packed = packAnnual(window);
    const muD = packed.mu.map((m) => m / 252);
    const covD = packed.cov.map((row) => row.map((v) => v / 252));
    const wEw = equalWeight(N);
    const wGmv = globalMinVariance(covD, true);
    const wSh = maxSharpe(muD, covD, rf, true);
    const wErc = riskParity(covD);
    const r = returns[t]!;
    const dot = (w: number[]) => w.reduce((s, wi, i) => s + wi * (r[i] ?? 0), 0);
    ew *= 1 + dot(wEw);
    gmvW *= 1 + dot(wGmv);
    sh *= 1 + dot(wSh);
    erc *= 1 + dot(wErc);
    points.push({ t, ew, gmv: gmvW, sharpe: sh, erc });
  }
  return {
    points,
    terminal: { ew, gmv: gmvW, sharpe: sh, erc },
  };
}
