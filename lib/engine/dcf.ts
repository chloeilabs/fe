/**
 * Two-stage FCFF discounted cash flow.
 * Stage 1: explicit growth for n years.
 * Terminal: Gordon growth on FCFF_{n+1}.
 * WACC from CAPM cost of equity blended with after-tax cost of debt.
 */
export type DcfInput = {
  fcff: number;
  shares: number;
  netDebt: number;
  growthHigh: number;
  growthStable: number;
  yearsHigh: number;
  wacc: number;
};

export type DcfResult = {
  enterpriseValue: number;
  equityValue: number;
  perShare: number;
  pvExplicit: number;
  pvTerminal: number;
  terminalValue: number;
};

export function waccFromCapm(args: {
  rf: number;
  beta: number;
  erp: number;
  costDebt: number;
  taxRate: number;
  equityWeight: number;
}): number {
  const ke = args.rf + args.beta * args.erp;
  const kd = args.costDebt * (1 - args.taxRate);
  const we = Math.min(Math.max(args.equityWeight, 0), 1);
  return we * ke + (1 - we) * kd;
}

export function twoStageFcff(input: DcfInput): DcfResult {
  const gH = input.growthHigh;
  const gS = input.growthStable;
  const n = Math.max(1, Math.round(input.yearsHigh));
  const r = input.wacc;
  if (r <= gS) {
    const fallback = input.fcff / Math.max(r - Math.min(gS, r - 0.01), 0.01);
    return {
      enterpriseValue: fallback,
      equityValue: fallback - input.netDebt,
      perShare: (fallback - input.netDebt) / Math.max(input.shares, 1e-9),
      pvExplicit: 0,
      pvTerminal: fallback,
      terminalValue: fallback,
    };
  }

  let pvExplicit = 0;
  let fcffT = input.fcff;
  for (let t = 1; t <= n; t += 1) {
    fcffT *= 1 + gH;
    pvExplicit += fcffT / (1 + r) ** t;
  }
  const fcffN1 = fcffT * (1 + gS);
  const terminalValue = fcffN1 / (r - gS);
  const pvTerminal = terminalValue / (1 + r) ** n;
  const enterpriseValue = pvExplicit + pvTerminal;
  const equityValue = enterpriseValue - input.netDebt;
  return {
    enterpriseValue,
    equityValue,
    perShare: equityValue / Math.max(input.shares, 1e-9),
    pvExplicit,
    pvTerminal,
    terminalValue,
  };
}

export function gordon(fcff: number, r: number, g: number): number {
  return fcff * (1 + g) / Math.max(r - g, 1e-6);
}
