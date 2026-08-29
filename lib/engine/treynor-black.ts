import { projectSimplex } from "@/lib/engine/matrix";

export type TbAsset = {
  alpha: number;
  residualVar: number;
  beta: number;
};

export type TreynorBlackResult = {
  activeWeights: number[];
  appraisal: number[];
  alphaActive: number;
  residualVarActive: number;
  betaActive: number;
  wActive: number;
  wPassive: number;
  weights: number[];
};

function equal(n: number): number[] {
  return Array.from({ length: n }, () => 1 / Math.max(n, 1));
}

/**
 * Treynor–Black active overlay (Bodie / Kane / Marcus).
 * w_i^A ∝ α_i / σ²_εi,  w_A^0 = (α_A/σ²_A) / (μ_M/σ²_M),
 * w_A^* = w_A^0 / (1 + (1 − β_A) w_A^0).
 */
export function treynorBlack(
  assets: TbAsset[],
  marketExcess: number,
  marketVar: number,
  passive: number[],
  longOnly = true,
): TreynorBlackResult {
  const n = assets.length;
  const wM = passive.length === n ? [...passive] : equal(n);
  const empty: TreynorBlackResult = {
    activeWeights: equal(n),
    appraisal: assets.map(() => 0),
    alphaActive: 0,
    residualVarActive: 0,
    betaActive: 0,
    wActive: 0,
    wPassive: 1,
    weights: wM,
  };
  if (!n || marketVar < 1e-18) return empty;

  const raw = assets.map((a) => (a.residualVar > 1e-18 ? a.alpha / a.residualVar : 0));
  const appraisal = assets.map((a) => (a.residualVar > 1e-18 ? a.alpha / Math.sqrt(a.residualVar) : 0));
  const tilted = longOnly ? raw.map((v) => Math.max(v, 0)) : raw;
  const sum = tilted.reduce((s, v) => s + v, 0);
  const activeWeights = sum > 1e-12 ? tilted.map((v) => v / sum) : equal(n);

  const alphaActive = activeWeights.reduce((s, w, i) => s + w * (assets[i]?.alpha ?? 0), 0);
  const residualVarActive = activeWeights.reduce(
    (s, w, i) => s + w * w * (assets[i]?.residualVar ?? 0),
    0,
  );
  const betaActive = activeWeights.reduce((s, w, i) => s + w * (assets[i]?.beta ?? 0), 0);
  if (residualVarActive < 1e-18 || Math.abs(alphaActive) < 1e-16) {
    return { ...empty, activeWeights, appraisal, betaActive };
  }

  const wA0 = alphaActive / residualVarActive / (marketExcess / marketVar);
  const wActive = wA0 / (1 + (1 - betaActive) * wA0);
  const wPassive = 1 - wActive;
  let weights = wM.map((w, i) => wPassive * w + wActive * (activeWeights[i] ?? 0));
  if (longOnly) weights = projectSimplex(weights);
  const tot = weights.reduce((s, w) => s + w, 0);
  if (Math.abs(tot) > 1e-12) weights = weights.map((w) => w / tot);

  return {
    activeWeights,
    appraisal,
    alphaActive,
    residualVarActive,
    betaActive,
    wActive,
    wPassive,
    weights,
  };
}
