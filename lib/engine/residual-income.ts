/**
 * Residual-income (Edwards–Bell–Ohlson) equity value.
 * V_0 = B_0 + Σ_t (ROE − r) B_{t−1} / (1+r)^t + TV
 * Book grows at g (clean-surplus if payout = 1 − g/ROE).
 */
export type ResidualIncomeInput = {
  bookValue: number;
  roe: number;
  costEquity: number;
  growth: number;
  years: number;
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
  const n = Math.max(1, Math.round(input.years));
  if (!Number.isFinite(B0) || B0 === 0) {
    return { equityValue: 0, pvResidual: 0, pvTerminal: 0, terminalValue: 0 };
  }
  let book = B0;
  let pvResidual = 0;
  for (let t = 1; t <= n; t += 1) {
    const ri = (roe - r) * book;
    pvResidual += ri / (1 + r) ** t;
    book *= 1 + g;
  }
  const riNext = (roe - r) * book;
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
