import { ASSET_CLASSES, DEFAULT_TARGET, type AssetClass, type TargetAllocation } from "@/lib/engine/allocation";

export const ACCOUNTS = ["taxable", "ira", "roth", "401k", "hsa", "other"] as const;
export type AccountType = (typeof ACCOUNTS)[number];

export const ACCOUNT_LABELS: Record<AccountType, string> = {
  taxable: "Taxable",
  ira: "Traditional IRA",
  roth: "Roth IRA",
  "401k": "401(k)",
  hsa: "HSA",
  other: "Other",
};

export type Holding = {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  costPerShare: number;
  account: AccountType;
  assetClass: AssetClass;
  notes?: string;
};

export type GoalPlan = {
  currentAge: number;
  retirementAge: number;
  annualIncome: number;
  annualSpend: number;
  monthlyContribution: number;
  contributionGrowth: number;
  expectedReturn: number;
  expectedVol: number;
  inflation: number;
  safeWithdrawalRate: number;
};

export type PortfolioState = {
  version: 1;
  holdings: Holding[];
  cash: number;
  watchlist: string[];
  target: TargetAllocation;
  goals: GoalPlan;
};

export const DEFAULT_GOALS: GoalPlan = {
  currentAge: 32,
  retirementAge: 55,
  annualIncome: 165000,
  annualSpend: 72000,
  monthlyContribution: 2500,
  contributionGrowth: 0.03,
  expectedReturn: 0.07,
  expectedVol: 0.15,
  inflation: 0.025,
  safeWithdrawalRate: 0.04,
};

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2, 10)}`;
}

export const SEED_PORTFOLIO: PortfolioState = {
  version: 1,
  cash: 8500,
  watchlist: ["NVDA", "MSFT", "VTI"],
  target: { ...DEFAULT_TARGET },
  goals: { ...DEFAULT_GOALS },
  holdings: [
    {
      id: "seed-vti",
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      shares: 42,
      costPerShare: 228.4,
      account: "roth",
      assetClass: "us-equity",
    },
    {
      id: "seed-vxus",
      symbol: "VXUS",
      name: "Vanguard Total International Stock ETF",
      shares: 68,
      costPerShare: 58.1,
      account: "roth",
      assetClass: "intl-equity",
    },
    {
      id: "seed-bnd",
      symbol: "BND",
      name: "Vanguard Total Bond Market ETF",
      shares: 55,
      costPerShare: 72.4,
      account: "ira",
      assetClass: "bond",
    },
    {
      id: "seed-aapl",
      symbol: "AAPL",
      name: "Apple Inc.",
      shares: 12,
      costPerShare: 178.2,
      account: "taxable",
      assetClass: "us-equity",
    },
  ],
};

export function isAssetClass(value: string): value is AssetClass {
  return (ASSET_CLASSES as readonly string[]).includes(value);
}

export function isAccount(value: string): value is AccountType {
  return (ACCOUNTS as readonly string[]).includes(value);
}
