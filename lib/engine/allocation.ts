export const ASSET_CLASSES = [
  "us-equity",
  "intl-equity",
  "bond",
  "cash",
  "crypto",
  "reit",
  "other",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  "us-equity": "US equity",
  "intl-equity": "Intl equity",
  bond: "Bonds",
  cash: "Cash",
  crypto: "Crypto",
  reit: "REITs",
  other: "Other",
};

export type TargetAllocation = Record<AssetClass, number>;

export const DEFAULT_TARGET: TargetAllocation = {
  "us-equity": 0.55,
  "intl-equity": 0.2,
  bond: 0.15,
  cash: 0.1,
  crypto: 0,
  reit: 0,
  other: 0,
};

export type ClassValue = { assetClass: AssetClass; value: number };

export type RebalanceLine = {
  assetClass: AssetClass;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  targetValue: number;
  dollars: number;
};

export function normalizeTarget(target: TargetAllocation): TargetAllocation {
  const sum = ASSET_CLASSES.reduce((acc, key) => acc + (target[key] ?? 0), 0);
  if (sum <= 0) return { ...DEFAULT_TARGET };
  return Object.fromEntries(ASSET_CLASSES.map((key) => [key, (target[key] ?? 0) / sum])) as TargetAllocation;
}

export function classWeights(values: ClassValue[]): Record<AssetClass, number> {
  const totals = Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<AssetClass, number>;
  for (const row of values) totals[row.assetClass] += row.value;
  const sum = ASSET_CLASSES.reduce((acc, key) => acc + totals[key], 0);
  if (sum <= 0) return totals;
  return Object.fromEntries(ASSET_CLASSES.map((key) => [key, totals[key] / sum])) as Record<AssetClass, number>;
}

export function rebalancePlan(values: ClassValue[], target: TargetAllocation): {
  total: number;
  lines: RebalanceLine[];
} {
  const totals = Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<AssetClass, number>;
  for (const row of values) totals[row.assetClass] += Math.max(0, row.value);
  const total = ASSET_CLASSES.reduce((acc, key) => acc + totals[key], 0);
  const norm = normalizeTarget(target);
  const lines = ASSET_CLASSES.map((assetClass) => {
    const currentValue = totals[assetClass];
    const targetWeight = norm[assetClass];
    const targetValue = total * targetWeight;
    return {
      assetClass,
      currentValue,
      currentWeight: total > 0 ? currentValue / total : 0,
      targetWeight,
      targetValue,
      dollars: targetValue - currentValue,
    };
  });
  return { total, lines };
}

export function driftScore(lines: RebalanceLine[]): number {
  return lines.reduce((acc, line) => acc + Math.abs(line.currentWeight - line.targetWeight), 0) / 2;
}
