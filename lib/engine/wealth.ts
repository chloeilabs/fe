import { clamp, gaussian, mean, mulberry32, percentile, stdev } from "./stats";

export type ProjectionInput = {
  presentValue: number;
  monthlyContribution: number;
  annualReturn: number;
  inflation?: number;
  years: number;
  contributionGrowth?: number;
};

export function realReturn(nominal: number, inflation: number) {
  return (1 + nominal) / (1 + inflation) - 1;
}

export function futureValue({
  presentValue,
  monthlyContribution,
  annualReturn,
  inflation = 0,
  years,
  contributionGrowth = 0,
}: ProjectionInput): number {
  const r = realReturn(annualReturn, inflation) / 12;
  const n = Math.max(0, Math.round(years * 12));
  let value = presentValue;
  let pmt = monthlyContribution;
  for (let m = 0; m < n; m++) {
    value = value * (1 + r) + pmt;
    if (contributionGrowth && (m + 1) % 12 === 0) {
      pmt *= 1 + contributionGrowth;
    }
  }
  return value;
}

export function requiredMonthlyContribution({
  presentValue,
  annualReturn,
  inflation = 0,
  years,
  target,
}: Omit<ProjectionInput, "monthlyContribution"> & { target: number }): number {
  const r = realReturn(annualReturn, inflation) / 12;
  const n = Math.max(1, Math.round(years * 12));
  const grown = presentValue * (1 + r) ** n;
  const remaining = target - grown;
  if (remaining <= 0) return 0;
  if (Math.abs(r) < 1e-12) return remaining / n;
  return (remaining * r) / ((1 + r) ** n - 1);
}

export function yearsToTarget({
  presentValue,
  monthlyContribution,
  annualReturn,
  inflation = 0,
  target,
  contributionGrowth = 0,
  horizonYears = 80,
}: Omit<ProjectionInput, "years"> & { target: number; horizonYears?: number }): number | null {
  if (target <= 0) return 0;
  if (presentValue >= target) return 0;
  const atHorizon = futureValue({
    presentValue,
    monthlyContribution,
    annualReturn,
    inflation,
    years: horizonYears,
    contributionGrowth,
  });
  if (atHorizon < target) return null;
  let lo = 0;
  let hi = horizonYears;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const fv = futureValue({
      presentValue,
      monthlyContribution,
      annualReturn,
      inflation,
      years: mid,
      contributionGrowth,
    });
    if (fv >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function fireNumber(annualSpend: number, safeWithdrawalRate: number) {
  if (safeWithdrawalRate <= 0) return Number.POSITIVE_INFINITY;
  return annualSpend / safeWithdrawalRate;
}

export function coastFireValue({
  target,
  annualReturn,
  inflation = 0,
  yearsToRetirement,
}: {
  target: number;
  annualReturn: number;
  inflation?: number;
  yearsToRetirement: number;
}) {
  const r = realReturn(annualReturn, inflation);
  if (yearsToRetirement <= 0) return target;
  return target / (1 + r) ** yearsToRetirement;
}

export function savingsRate(monthlyContribution: number, annualIncome: number) {
  if (annualIncome <= 0) return 0;
  return (monthlyContribution * 12) / annualIncome;
}

export type MonteCarloInput = ProjectionInput & {
  annualVolatility: number;
  paths?: number;
  seed?: number;
  target?: number;
};

export type MonteCarloResult = {
  years: number[];
  p10: number[];
  p50: number[];
  p90: number[];
  medianEnd: number;
  successRate: number;
  expectedShortfall: number;
};

export function monteCarloProjection({
  presentValue,
  monthlyContribution,
  annualReturn,
  inflation = 0,
  years,
  contributionGrowth = 0,
  annualVolatility,
  paths = 800,
  seed = 7,
  target = 0,
}: MonteCarloInput): MonteCarloResult {
  const rng = mulberry32(seed);
  const months = Math.max(1, Math.round(years * 12));
  const mu = realReturn(annualReturn, inflation);
  const monthlyMu = mu / 12;
  const monthlyVol = annualVolatility / Math.sqrt(12);
  const yearMarks = Array.from({ length: years + 1 }, (_, i) => i);
  const byYear: number[][] = yearMarks.map(() => []);
  const terminals: number[] = [];

  for (let p = 0; p < paths; p++) {
    let value = presentValue;
    let pmt = monthlyContribution;
    byYear[0]!.push(value);
    for (let m = 1; m <= months; m++) {
      const shock = gaussian(rng);
      const growth = Math.exp(monthlyMu - 0.5 * monthlyVol ** 2 + monthlyVol * shock);
      value = value * growth + pmt;
      if (contributionGrowth && m % 12 === 0) pmt *= 1 + contributionGrowth;
      if (m % 12 === 0) byYear[m / 12]!.push(value);
    }
    terminals.push(value);
  }

  const p10: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  for (const bucket of byYear) {
    const sorted = [...bucket].sort((a, b) => a - b);
    p10.push(percentile(sorted, 0.1));
    p50.push(percentile(sorted, 0.5));
    p90.push(percentile(sorted, 0.9));
  }

  const sortedEnds = [...terminals].sort((a, b) => a - b);
  const misses = terminals.filter((v) => v < target);
  return {
    years: yearMarks,
    p10,
    p50,
    p90,
    medianEnd: percentile(sortedEnds, 0.5),
    successRate: target > 0 ? terminals.filter((v) => v >= target).length / paths : 1,
    expectedShortfall: misses.length ? mean(misses.map((v) => target - v)) : 0,
  };
}

export function glidepathEquity(age: number, retirementAge: number) {
  const yearsLeft = Math.max(0, retirementAge - age);
  const raw = 0.3 + yearsLeft * 0.012;
  return clamp(raw, 0.3, 0.9);
}

export { mean, stdev };
