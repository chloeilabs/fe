import { mulberry32 } from "@/lib/engine/stats";
import type {
  FmpDcf,
  FmpCashFlow,
  FmpBalanceSheet,
  FmpDividend,
  FmpEtfHolding,
  FmpEtfInfo,
  FmpEtfSector,
  FmpGrades,
  FmpGrowth,
  FmpKeyMetrics,
  FmpOwnerEarnings,
  FmpSectorPe,
  FmpEarnings,
  FmpEconEvent,
  FmpEconPoint,
  FmpEstimate,
  FmpHours,
  FmpIncome,
  FmpLightBar,
  FmpMetricsTtm,
  FmpMover,
  FmpNews,
  FmpPeer,
  FmpPriceChange,
  FmpPriceTarget,
  FmpProfile,
  FmpQuote,
  FmpRating,
  FmpRatiosTtm,
  FmpRiskPremium,
  FmpScore,
  FmpScreenerRow,
  FmpSearchHit,
  FmpSector,
  FmpTreasury,
} from "@/lib/fmp/types";

type Spec = {
  name: string;
  price: number;
  prev: number;
  exchange: string;
  sector?: string;
  industry?: string;
  cap?: number;
  beta?: number;
  etf?: boolean;
  mu?: number;
  vol?: number;
};

const SPECS: Record<string, Spec> = {
  AAPL: { name: "Apple Inc.", price: 331.86, prev: 338.19, exchange: "NASDAQ", sector: "Technology", industry: "Consumer Electronics", cap: 4.87e12, beta: 1.1, mu: 0.18, vol: 0.22 },
  MSFT: { name: "Microsoft Corporation", price: 428.4, prev: 431.1, exchange: "NASDAQ", sector: "Technology", industry: "Software", cap: 3.18e12, beta: 0.92, mu: 0.16, vol: 0.2 },
  NVDA: { name: "NVIDIA Corporation", price: 178.2, prev: 174.5, exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors", cap: 4.36e12, beta: 1.7, mu: 0.32, vol: 0.45 },
  GOOGL: { name: "Alphabet Inc.", price: 201.4, prev: 199.8, exchange: "NASDAQ", sector: "Communication Services", industry: "Internet Content", cap: 2.45e12, beta: 1.02, mu: 0.17, vol: 0.24 },
  AMZN: { name: "Amazon.com, Inc.", price: 228.7, prev: 231.2, exchange: "NASDAQ", sector: "Consumer Cyclical", industry: "Internet Retail", cap: 2.41e12, beta: 1.15, mu: 0.15, vol: 0.28 },
  META: { name: "Meta Platforms, Inc.", price: 742.1, prev: 736.4, exchange: "NASDAQ", sector: "Communication Services", industry: "Internet Content", cap: 1.87e12, beta: 1.21, mu: 0.2, vol: 0.3 },
  VTI: { name: "Vanguard Total Stock Market ETF", price: 292.15, prev: 290.4, exchange: "AMEX", sector: "Financial Services", industry: "Asset Management", cap: 1.6e12, beta: 1.01, etf: true, mu: 0.1, vol: 0.16 },
  VXUS: { name: "Vanguard Total International Stock ETF", price: 64.8, prev: 64.55, exchange: "NASDAQ", sector: "Financial Services", industry: "Asset Management", cap: 7.2e10, beta: 0.86, etf: true, mu: 0.07, vol: 0.15 },
  BND: { name: "Vanguard Total Bond Market ETF", price: 73.1, prev: 73.22, exchange: "NASDAQ", sector: "Financial Services", industry: "Asset Management", cap: 1.1e11, beta: 0.18, etf: true, mu: 0.035, vol: 0.06 },
  SPY: { name: "SPDR S&P 500 ETF Trust", price: 641.2, prev: 637.8, exchange: "AMEX", sector: "Financial Services", industry: "Asset Management", cap: 5.8e11, beta: 1, etf: true, mu: 0.1, vol: 0.15 },
  IWM: { name: "iShares Russell 2000 ETF", price: 218.4, prev: 216.9, exchange: "AMEX", sector: "Financial Services", industry: "Asset Management", cap: 6.4e10, beta: 1.15, etf: true, mu: 0.09, vol: 0.22 },
  IWD: { name: "iShares Russell 1000 Value ETF", price: 184.2, prev: 183.6, exchange: "AMEX", sector: "Financial Services", industry: "Asset Management", cap: 5.8e10, beta: 0.92, etf: true, mu: 0.08, vol: 0.15 },
  IWF: { name: "iShares Russell 1000 Growth ETF", price: 412.7, prev: 410.1, exchange: "AMEX", sector: "Financial Services", industry: "Asset Management", cap: 9.1e10, beta: 1.12, etf: true, mu: 0.12, vol: 0.18 },
  "^GSPC": { name: "S&P 500", price: 6418.3, prev: 6384.1, exchange: "INDEX", mu: 0.1, vol: 0.15 },
  "^DJI": { name: "Dow Jones Industrial Average", price: 44912, prev: 44780, exchange: "INDEX", mu: 0.08, vol: 0.14 },
  "^IXIC": { name: "NASDAQ Composite", price: 21440, prev: 21290, exchange: "INDEX", mu: 0.12, vol: 0.2 },
  "^RUT": { name: "Russell 2000", price: 2264, prev: 2248, exchange: "INDEX", mu: 0.09, vol: 0.22 },
  "^VIX": { name: "CBOE Volatility Index", price: 16.4, prev: 17.1, exchange: "INDEX", mu: 0, vol: 0.8 },
};

function changePct(price: number, prev: number) {
  return prev ? ((price - prev) / prev) * 100 : 0;
}

function quoteFromSpec(symbol: string, spec: Spec): FmpQuote {
  const change = spec.price - spec.prev;
  return {
    symbol,
    name: spec.name,
    price: spec.price,
    change,
    changePercentage: changePct(spec.price, spec.prev),
    volume: 28_000_000,
    dayLow: spec.price * 0.992,
    dayHigh: spec.price * 1.008,
    yearHigh: spec.price * 1.18,
    yearLow: spec.price * 0.72,
    marketCap: spec.cap ?? 0,
    priceAvg50: spec.price * 0.97,
    priceAvg200: spec.price * 0.91,
    exchange: spec.exchange,
    open: spec.prev,
    previousClose: spec.prev,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export function sampleQuote(symbol: string): FmpQuote | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return quoteFromSpec(symbol.toUpperCase(), spec);
}

export function sampleQuotes(symbols: string[]): FmpQuote[] {
  return symbols.map((s) => sampleQuote(s)).filter((q): q is FmpQuote => q != null);
}

export function sampleSearch(query: string): FmpSearchHit[] {
  const q = query.trim().toLowerCase();
  return Object.entries(SPECS)
    .filter(([symbol, spec]) => symbol.toLowerCase().includes(q) || spec.name.toLowerCase().includes(q))
    .map(([symbol, spec]) => ({
      symbol,
      name: spec.name,
      currency: "USD",
      exchange: spec.exchange,
      exchangeFullName: spec.exchange,
    }))
    .slice(0, 12);
}

export function sampleProfile(symbol: string): FmpProfile | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return {
    symbol: symbol.toUpperCase(),
    price: spec.price,
    marketCap: spec.cap,
    beta: spec.beta,
    lastDividend: spec.etf ? 1.8 : 0.96,
    companyName: spec.name,
    currency: "USD",
    exchange: spec.exchange,
    industry: spec.industry,
    website: "https://financialmodelingprep.com",
    description: `${spec.name} sample profile used when an FMP API key is not configured. Add FMP_API_KEY for live fundamentals.`,
    ceo: spec.etf ? undefined : "—",
    sector: spec.sector,
    country: "US",
    image: `https://images.financialmodelingprep.com/symbol/${symbol.toUpperCase()}.png`,
    isEtf: spec.etf,
    isActivelyTrading: true,
  };
}

export function sampleHistory(symbol: string, days = 420): FmpLightBar[] {
  const spec = SPECS[symbol.toUpperCase()] ?? { name: symbol, price: 100, prev: 100, exchange: "NASDAQ", mu: 0.08, vol: 0.2 };
  const rng = mulberry32(symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const out: FmpLightBar[] = [];
  let price = spec.price / Math.exp((spec.mu ?? 0.08) * (days / 252));
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const dailyMu = (spec.mu ?? 0.08) / 252;
    const dailyVol = (spec.vol ?? 0.2) / Math.sqrt(252);
    const u = Math.max(rng(), 1e-9);
    const v = Math.max(rng(), 1e-9);
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    price *= Math.exp(dailyMu - 0.5 * dailyVol ** 2 + dailyVol * z);
    out.push({
      symbol: symbol.toUpperCase(),
      date: d.toISOString().slice(0, 10),
      price: Number(price.toFixed(4)),
      volume: Math.round(20_000_000 + rng() * 10_000_000),
    });
  }
  if (out.length) out[out.length - 1]!.price = spec.price;
  return out.reverse();
}

export function sampleDcf(symbol: string): FmpDcf | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return { symbol: symbol.toUpperCase(), date: new Date().toISOString().slice(0, 10), dcf: spec.price * 0.86, "Stock Price": spec.price };
}

export function sampleScores(symbol: string): FmpScore | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return { symbol: symbol.toUpperCase(), altmanZScore: spec.etf ? 4.2 : 11.4, piotroskiScore: spec.etf ? 6 : 8 };
}

export function sampleRatios(symbol: string): FmpRatiosTtm | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return {
    symbol: symbol.toUpperCase(),
    priceToEarningsRatioTTM: spec.etf ? 22 : 34.1,
    priceToBookRatioTTM: spec.etf ? 3.4 : 48,
    priceToSalesRatioTTM: spec.etf ? 2.1 : 9.2,
    priceToFreeCashFlowRatioTTM: spec.etf ? 18 : 38,
    dividendYieldTTM: 0.004,
    netProfitMarginTTM: spec.etf ? 0.18 : 0.27,
    grossProfitMarginTTM: spec.etf ? 0.4 : 0.47,
    currentRatioTTM: 1.07,
    debtToEquityRatioTTM: spec.etf ? 0.2 : 1.5,
    returnOnEquityTTM: spec.etf ? 0.18 : 1.47,
    returnOnAssetsTTM: spec.etf ? 0.08 : 0.33,
    bookValuePerShareTTM: spec.etf ? spec.price * 0.4 : spec.price * 0.02,
    shareholdersEquityPerShareTTM: spec.etf ? spec.price * 0.4 : spec.price * 0.02,
    dividendPerShareTTM: spec.etf ? 1.8 : 1.0,
  };
}

export function sampleMetrics(symbol: string): FmpMetricsTtm | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return {
    symbol: symbol.toUpperCase(),
    marketCap: spec.cap,
    enterpriseValueTTM: (spec.cap ?? 0) * 1.02,
    evToEBITDATTM: 30.7,
    returnOnEquityTTM: spec.etf ? 0.18 : 1.47,
    returnOnInvestedCapitalTTM: spec.etf ? 0.12 : 0.5,
    earningsYieldTTM: 0.025,
    freeCashFlowYieldTTM: 0.026,
    freeCashFlowToFirmTTM: (spec.cap ?? 0) * 0.028,
    grahamNumberTTM: spec.price * 0.11,
  };
}

export function sampleScreener(): FmpScreenerRow[] {
  return Object.entries(SPECS)
    .filter(([, spec]) => spec.exchange !== "INDEX")
    .map(([symbol, spec]) => ({
      symbol,
      companyName: spec.name,
      marketCap: spec.cap,
      sector: spec.sector,
      industry: spec.industry,
      beta: spec.beta,
      price: spec.price,
      lastAnnualDividend: spec.etf ? 2.1 : 0.96,
      volume: 20_000_000,
      exchange: spec.exchange,
      exchangeShortName: spec.exchange,
      country: "US",
      isEtf: spec.etf,
      isFund: false,
      isActivelyTrading: true,
    }));
}

export function sampleNews(symbol?: string): FmpNews[] {
  const tickers = symbol ? [symbol.toUpperCase()] : ["AAPL", "MSFT", "NVDA", "VTI"];
  return tickers.map((s, i) => ({
    symbol: s,
    publishedDate: new Date(Date.now() - i * 3600_000).toISOString().replace("T", " ").slice(0, 19),
    publisher: "Compound Desk",
    title: `${s} sample headline — live FMP news appears after you add an API key`,
    text: "This is sample market copy used when FMP_API_KEY is not set.",
    url: `https://site.financialmodelingprep.com/api-docs.md#${s}`,
    site: "financialmodelingprep.com",
  }));
}

export function sampleMovers(kind: "gainers" | "losers" | "actives"): FmpMover[] {
  const quotes = sampleQuotes(["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL"]);
  const sorted = [...quotes].sort((a, b) => (b.changePercentage ?? 0) - (a.changePercentage ?? 0));
  const pick = kind === "losers" ? sorted.slice().reverse() : sorted;
  return pick.map((q) => ({
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    change: q.change,
    changesPercentage: q.changePercentage,
    exchange: q.exchange,
  }));
}

export function sampleSectors(): FmpSector[] {
  return [
    { sector: "Technology", averageChange: 0.84 },
    { sector: "Healthcare", averageChange: 0.21 },
    { sector: "Financial Services", averageChange: -0.14 },
    { sector: "Energy", averageChange: 0.55 },
    { sector: "Consumer Cyclical", averageChange: -0.32 },
    { sector: "Industrials", averageChange: 0.18 },
    { sector: "Utilities", averageChange: 0.07 },
    { sector: "Real Estate", averageChange: -0.41 },
  ];
}

export function sampleTreasury(): FmpTreasury {
  return {
    date: new Date().toISOString().slice(0, 10),
    month1: 4.21,
    month3: 4.18,
    month6: 4.05,
    year1: 3.92,
    year2: 3.78,
    year5: 3.86,
    year10: 4.12,
    year30: 4.58,
  };
}

export function sampleHours(): FmpHours {
  return {
    exchange: "NASDAQ",
    name: "NASDAQ",
    openingHour: "09:30 AM",
    closingHour: "04:00 PM",
    timezone: "America/New_York",
    isMarketOpen: false,
  };
}

export function samplePriceChange(symbol: string): FmpPriceChange | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return {
    symbol: symbol.toUpperCase(),
    "1D": changePct(spec.price, spec.prev),
    "5D": 1.8,
    "1M": 4.2,
    "3M": 9.4,
    "6M": 14.1,
    ytd: 12.6,
    "1Y": 22.4,
    "5Y": 98.2,
  };
}

export function samplePeers(symbol: string): FmpPeer[] {
  const pool = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA"].filter((s) => s !== symbol.toUpperCase());
  return pool.slice(0, 4).map((s) => {
    const spec = SPECS[s]!;
    return { symbol: s, companyName: spec.name, price: spec.price, mktCap: spec.cap };
  });
}

export function sampleIncome(symbol: string): FmpIncome[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  return [2025, 2024, 2023].map((year, i) => ({
    symbol: symbol.toUpperCase(),
    date: `${year}-09-27`,
    fiscalYear: String(year),
    period: "FY",
    revenue: 390e9 * (1 - i * 0.05),
    netIncome: 97e9 * (1 - i * 0.06),
    eps: 6.4 - i * 0.3,
    ebitda: 130e9 * (1 - i * 0.04),
    operatingIncome: 120e9 * (1 - i * 0.05),
    weightedAverageShsOut: spec.cap && spec.price ? spec.cap / spec.price : 1e9,
  }));
}

export function sampleCashFlow(symbol: string): FmpCashFlow[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  const fcf = (spec.cap ?? 0) * 0.026;
  return [2025, 2024, 2023].map((year, i) => ({
    symbol: symbol.toUpperCase(),
    date: `${year}-09-27`,
    fiscalYear: String(year),
    period: "FY",
    freeCashFlow: fcf * (1 - i * 0.04),
    operatingCashFlow: fcf * 1.35 * (1 - i * 0.04),
    capitalExpenditure: -fcf * 0.35,
  }));
}

export function sampleBalanceSheet(symbol: string): FmpBalanceSheet[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  const assets = (spec.cap ?? 1e11) * 0.35;
  const debt = assets * 0.31;
  const cash = assets * 0.1;
  return [2025, 2024, 2023].map((year, i) => ({
    symbol: symbol.toUpperCase(),
    date: `${year}-09-27`,
    fiscalYear: String(year),
    period: "FY",
    cashAndCashEquivalents: cash * (1 - i * 0.03),
    cashAndShortTermInvestments: cash * 1.5 * (1 - i * 0.03),
    totalAssets: assets * (1 - i * 0.04),
    totalDebt: debt * (1 - i * 0.02),
    netDebt: (debt - cash) * (1 - i * 0.02),
    totalStockholdersEquity: (assets - debt) * (1 - i * 0.05),
    shortTermDebt: debt * 0.18,
    longTermDebt: debt * 0.7,
  }));
}

export function sampleEstimates(symbol: string): FmpEstimate[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  const eps = spec.etf ? 12 : 7.4;
  const rev = spec.etf ? 0 : 420e9;
  return [2026, 2027, 2028].map((year, i) => ({
    symbol: symbol.toUpperCase(),
    date: `${year}-09-27`,
    revenueAvg: rev * (1 + 0.08 * (i + 1)),
    revenueLow: rev * (1 + 0.05 * (i + 1)),
    revenueHigh: rev * (1 + 0.12 * (i + 1)),
    epsAvg: eps * (1 + 0.09 * (i + 1)),
    epsLow: eps * (1 + 0.04 * (i + 1)),
    epsHigh: eps * (1 + 0.14 * (i + 1)),
    ebitdaAvg: rev * 0.34 * (1 + 0.07 * (i + 1)),
    netIncomeAvg: rev * 0.25 * (1 + 0.08 * (i + 1)),
    numAnalystsRevenue: 18 - i,
    numAnalystsEps: 22 - i,
  }));
}

export function sampleEarnings(symbol: string): FmpEarnings[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  const base = spec.etf ? 1.8 : 1.52;
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i * 3);
    const est = base * (1 - i * 0.03);
    const beat = i % 2 === 0 ? 0.08 : -0.02;
    return {
      symbol: symbol.toUpperCase(),
      date: d.toISOString().slice(0, 10),
      epsActual: Number((est + beat).toFixed(2)),
      epsEstimated: Number(est.toFixed(2)),
      revenueActual: spec.etf ? null : 94e9 * (1 - i * 0.02),
      revenueEstimated: spec.etf ? null : 91e9 * (1 - i * 0.02),
    };
  });
}

export function samplePriceTarget(symbol: string): FmpPriceTarget | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return {
    symbol: symbol.toUpperCase(),
    targetHigh: spec.price * 1.22,
    targetLow: spec.price * 0.78,
    targetConsensus: spec.price * 1.04,
    targetMedian: spec.price * 1.05,
  };
}

export function sampleRating(symbol: string): FmpRating | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return {
    symbol: symbol.toUpperCase(),
    rating: spec.etf ? "A" : "B",
    overallScore: spec.etf ? 4 : 3,
    discountedCashFlowScore: 3,
    returnOnEquityScore: spec.etf ? 4 : 5,
    returnOnAssetsScore: 4,
    debtToEquityScore: spec.etf ? 4 : 1,
    priceToEarningsScore: 2,
    priceToBookScore: 1,
  };
}

export function sampleRiskPremium(): FmpRiskPremium[] {
  return [
    { country: "United States", continent: "North America", countryRiskPremium: 0, totalEquityRiskPremium: 5.0 },
    { country: "Germany", continent: "Europe", countryRiskPremium: 0.64, totalEquityRiskPremium: 5.64 },
    { country: "Japan", continent: "Asia", countryRiskPremium: 0.91, totalEquityRiskPremium: 5.91 },
    { country: "United Kingdom", continent: "Europe", countryRiskPremium: 0.91, totalEquityRiskPremium: 5.91 },
  ];
}

export function sampleEconIndicator(name: string): FmpEconPoint[] {
  const today = new Date();
  const seed =
    name === "CPI" ? 318.2 : name === "unemploymentRate" ? 4.2 : name === "federalFunds" ? 4.33 : 31422;
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date(today);
    d.setUTCMonth(d.getUTCMonth() - i);
    return { name, date: d.toISOString().slice(0, 10), value: seed * (1 - i * 0.004) };
  });
}

export function sampleEconCalendar(): FmpEconEvent[] {
  const day = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return `${d.toISOString().slice(0, 10)} 08:30:00`;
  };
  return [
    { date: day(2), country: "US", event: "CPI YoY", currency: "USD", previous: 2.7, estimate: 2.8, actual: null, impact: "High", unit: "%" },
    { date: day(5), country: "US", event: "Nonfarm Payrolls", currency: "USD", previous: 147, estimate: 160, actual: null, impact: "High", unit: "k" },
    { date: day(-2), country: "US", event: "Initial Jobless Claims", currency: "USD", previous: 221, estimate: 220, actual: 219, impact: "Medium", change: -2, unit: "k" },
    { date: day(9), country: "US", event: "FOMC Rate Decision", currency: "USD", previous: 4.5, estimate: 4.5, actual: null, impact: "High", unit: "%" },
    { date: day(1), country: "US", event: "Retail Sales MoM", currency: "USD", previous: 0.4, estimate: 0.3, actual: null, impact: "Medium", unit: "%" },
  ];
}

export function sampleEarningsCalendar(): FmpEarnings[] {
  return sampleEarnings("AAPL").slice(0, 2).concat(sampleEarnings("MSFT").slice(0, 1));
}

export function sampleOwnerEarnings(symbol: string): FmpOwnerEarnings[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  const oe = (spec.cap ?? 0) * 0.024;
  return [2025, 2024, 2023].map((year, i) => ({
    symbol: symbol.toUpperCase(),
    date: `${year}-09-27`,
    fiscalYear: String(year),
    period: "FY",
    ownersEarnings: oe * (1 - i * 0.05),
    ownersEarningsPerShare: spec.price * 0.026 * (1 - i * 0.04),
    maintenanceCapex: oe * 0.12,
    growthCapex: oe * 0.18,
  }));
}

export function sampleGrades(symbol: string): FmpGrades | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return {
    symbol: symbol.toUpperCase(),
    strongBuy: spec.etf ? 0 : 4,
    buy: spec.etf ? 2 : 28,
    hold: spec.etf ? 8 : 12,
    sell: spec.etf ? 1 : 3,
    strongSell: 0,
    consensus: spec.etf ? "Hold" : "Buy",
  };
}

export function sampleKeyMetrics(symbol: string): FmpKeyMetrics[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  return [2025, 2024, 2023].map((year, i) => ({
    symbol: symbol.toUpperCase(),
    date: `${year}-09-27`,
    fiscalYear: String(year),
    period: "FY",
    returnOnEquity: spec.etf ? 0.18 : 1.47 * (1 - i * 0.04),
    returnOnInvestedCapital: spec.etf ? 0.12 : 0.5,
    enterpriseValue: (spec.cap ?? 0) * 1.02,
    marketCap: spec.cap,
    grahamNumber: spec.price * 0.11,
    tangibleAssetValue: (spec.cap ?? 0) * 0.02,
    freeCashFlowToFirm: (spec.cap ?? 0) * 0.028,
  }));
}

export function sampleGrowth(symbol: string): FmpGrowth[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  return [2025, 2024].map((year, i) => ({
    symbol: symbol.toUpperCase(),
    date: `${year}-09-27`,
    fiscalYear: String(year),
    revenueGrowth: spec.etf ? 0.08 : 0.064 - i * 0.01,
    netIncomeGrowth: spec.etf ? 0.07 : 0.195 - i * 0.02,
    epsgrowth: spec.etf ? 0.07 : 0.226,
    freeCashFlowGrowth: spec.etf ? 0.06 : -0.09,
    bookValueperShareGrowth: spec.etf ? 0.05 : 0.33,
    dividendsPerShareGrowth: 0.04,
  }));
}

export function sampleDividends(symbol: string): FmpDividend[] {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return [];
  const dps = spec.etf ? 0.85 : 0.25;
  return [0, 1, 2, 3].map((i) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i * 3);
    return {
      symbol: symbol.toUpperCase(),
      date: d.toISOString().slice(0, 10),
      adjDividend: dps,
      dividend: dps,
      yield: dps * 4 / spec.price,
      frequency: "Quarterly",
    };
  });
}

export function sampleEtfHoldings(symbol: string): FmpEtfHolding[] {
  const names = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META"].filter((s) => s !== symbol.toUpperCase());
  const w = [7.8, 6.9, 6.4, 3.8, 3.5, 2.9];
  return names.slice(0, 6).map((asset, i) => ({
    symbol: symbol.toUpperCase(),
    asset,
    name: SPECS[asset]?.name ?? asset,
    weightPercentage: w[i] ?? 1,
    marketValue: (SPECS[asset]?.cap ?? 1e11) * 0.01,
  }));
}

export function sampleEtfInfo(symbol: string): FmpEtfInfo | null {
  const spec = SPECS[symbol.toUpperCase()];
  if (!spec) return null;
  return {
    symbol: symbol.toUpperCase(),
    name: spec.name,
    expenseRatio: 0.03,
    assetsUnderManagement: spec.cap ?? 1e11,
    holdingsCount: 3800,
    assetClass: "Equity",
    inceptionDate: "2001-05-24",
    nav: spec.price,
  };
}

export function sampleEtfSectors(symbol: string): FmpEtfSector[] {
  return [
    { symbol: symbol.toUpperCase(), sector: "Technology", weightPercentage: 31.2 },
    { symbol: symbol.toUpperCase(), sector: "Financial Services", weightPercentage: 13.4 },
    { symbol: symbol.toUpperCase(), sector: "Healthcare", weightPercentage: 12.1 },
    { symbol: symbol.toUpperCase(), sector: "Consumer Cyclical", weightPercentage: 10.8 },
    { symbol: symbol.toUpperCase(), sector: "Industrials", weightPercentage: 8.9 },
  ];
}

export function sampleSectorPe(): FmpSectorPe[] {
  return [
    { date: new Date().toISOString().slice(0, 10), sector: "Technology", exchange: "NASDAQ", pe: 34.2 },
    { date: new Date().toISOString().slice(0, 10), sector: "Healthcare", exchange: "NASDAQ", pe: 22.8 },
    { date: new Date().toISOString().slice(0, 10), sector: "Financial Services", exchange: "NASDAQ", pe: 16.4 },
    { date: new Date().toISOString().slice(0, 10), sector: "Energy", exchange: "NASDAQ", pe: 13.1 },
    { date: new Date().toISOString().slice(0, 10), sector: "Consumer Cyclical", exchange: "NASDAQ", pe: 24.6 },
    { date: new Date().toISOString().slice(0, 10), sector: "Utilities", exchange: "NASDAQ", pe: 18.9 },
  ];
}

export const SAMPLE_UNIVERSE = Object.keys(SPECS);
