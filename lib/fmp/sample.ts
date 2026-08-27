import { mulberry32 } from "@/lib/engine/stats";
import type {
  FmpDcf,
  FmpHours,
  FmpIncome,
  FmpLightBar,
  FmpMetricsTtm,
  FmpMover,
  FmpNews,
  FmpPeer,
  FmpPriceChange,
  FmpProfile,
  FmpQuote,
  FmpRatiosTtm,
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
  }));
}

export const SAMPLE_UNIVERSE = Object.keys(SPECS);
