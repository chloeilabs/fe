/**
 * Residual-income (Edwards–Bell–Ohlson) equity value.
 * V_0 = B_0 + Σ_t (ROE_t − r) B_{t−1} / (1+r)^t + TV
 * ROE_t = r + (ROE − r) ω^{t−1}. Book grows at g (clean-surplus if payout = 1 − g/ROE).
 */
export type ResidualIncomeInput = {
  bookValue: number;
  roe: number;
  costEquity: number;
  growth: number;
  years: number;
  /** Persistence of abnormal ROE. 1 = no fade (classic EBO). */
  fade?: number;
};

export type ResidualIncomeResult = {
  equityValue: number;
  pvResidual: number;
  pvTerminal: number;
  terminalValue: number;
};

export function residualIncome(input: ResidualIncomeInput): ResidualIncomeResult {
  const B0 = input.bookValue;
  const roe = input.roe;
  const r = input.costEquity;
  const g = input.growth;
  const fade = input.fade == null ? 1 : Math.min(Math.max(input.fade, 0), 1);
  const n = Math.max(1, Math.round(input.years));
  if (!Number.isFinite(B0) || B0 === 0) {
    return { equityValue: 0, pvResidual: 0, pvTerminal: 0, terminalValue: 0 };
  }
  let book = B0;
  let pvResidual = 0;
  for (let t = 1; t <= n; t += 1) {
    const roeT = r + (roe - r) * fade ** (t - 1);
    const ri = (roeT - r) * book;
    pvResidual += ri / (1 + r) ** t;
    book *= 1 + g;
  }
  const roeNext = r + (roe - r) * fade ** n;
  const riNext = (roeNext - r) * book;
  let terminalValue = 0;
  let pvTerminal = 0;
  if (r > g + 1e-8) {
    terminalValue = riNext / (r - g);
    pvTerminal = terminalValue / (1 + r) ** n;
  } else if (Math.abs(roe - r) > 1e-12) {
    terminalValue = riNext / Math.max(r, 0.01);
    pvTerminal = terminalValue / (1 + r) ** n;
  }
  return {
    equityValue: B0 + pvResidual + pvTerminal,
    pvResidual,
    pvTerminal,
    terminalValue,
  };
}

/** Gordon on last DPS: P = DPS_0 (1+g) / (r − g). */
export function dividendDiscount(dps: number, r: number, g: number): number {
  return (dps * (1 + g)) / Math.max(r - g, 1e-6);
}
