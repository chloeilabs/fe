export type FmpQuote = {
  symbol: string;
  name?: string;
  price: number;
  changePercentage?: number;
  change?: number;
  volume?: number;
  dayLow?: number;
  dayHigh?: number;
  yearHigh?: number;
  yearLow?: number;
  marketCap?: number;
  priceAvg50?: number;
  priceAvg200?: number;
  exchange?: string;
  open?: number;
  previousClose?: number;
  timestamp?: number;
};

export type FmpSearchHit = {
  symbol: string;
  name: string;
  currency?: string;
  exchangeFullName?: string;
  exchange?: string;
};

export type FmpProfile = {
  symbol: string;
  price?: number;
  marketCap?: number;
  beta?: number;
  lastDividend?: number;
  range?: string;
  change?: number;
  changePercentage?: number;
  volume?: number;
  averageVolume?: number;
  companyName?: string;
  currency?: string;
  exchange?: string;
  industry?: string;
  website?: string;
  description?: string;
  ceo?: string;
  sector?: string;
  country?: string;
  fullTimeEmployees?: string;
  image?: string;
  ipoDate?: string;
  isEtf?: boolean;
  isFund?: boolean;
  isActivelyTrading?: boolean;
};

export type FmpLightBar = {
  symbol: string;
  date: string;
  price: number;
  volume?: number;
};

export type FmpDcf = {
  symbol: string;
  date?: string;
  dcf: number;
  "Stock Price"?: number;
  stockPrice?: number;
};

export type FmpScore = {
  symbol: string;
  altmanZScore?: number;
  piotroskiScore?: number;
};

export type FmpScreenerRow = {
  symbol: string;
  companyName?: string;
  marketCap?: number;
  sector?: string;
  industry?: string;
  beta?: number;
  price?: number;
  lastAnnualDividend?: number;
  volume?: number;
  exchange?: string;
  exchangeShortName?: string;
  country?: string;
  isEtf?: boolean;
  isFund?: boolean;
  isActivelyTrading?: boolean;
};

export type FmpNews = {
  symbol?: string | null;
  publishedDate?: string;
  publisher?: string;
  title: string;
  image?: string;
  site?: string;
  text?: string;
  url?: string;
};

export type FmpMover = {
  symbol: string;
  price: number;
  name?: string;
  change?: number;
  changesPercentage?: number;
  exchange?: string;
};

export type FmpSector = {
  date?: string;
  sector: string;
  exchange?: string;
  averageChange: number;
};

export type FmpTreasury = {
  date: string;
  month1?: number;
  month2?: number;
  month3?: number;
  month6?: number;
  year1?: number;
  year2?: number;
  year3?: number;
  year5?: number;
  year7?: number;
  year10?: number;
  year20?: number;
  year30?: number;
};

export type FmpHours = {
  exchange?: string;
  name?: string;
  openingHour?: string;
  closingHour?: string;
  timezone?: string;
  isMarketOpen?: boolean;
};

export type FmpPriceChange = {
  symbol: string;
  "1D"?: number;
  "5D"?: number;
  "1M"?: number;
  "3M"?: number;
  "6M"?: number;
  ytd?: number;
  "1Y"?: number;
  "3Y"?: number;
  "5Y"?: number;
  "10Y"?: number;
  max?: number;
};

export type FmpPeer = {
  symbol: string;
  companyName?: string;
  price?: number;
  mktCap?: number;
};

export type FmpIncome = {
  symbol: string;
  date?: string;
  fiscalYear?: string;
  period?: string;
  revenue?: number;
  netIncome?: number;
  eps?: number;
  ebitda?: number;
  operatingIncome?: number;
  weightedAverageShsOut?: number;
};

export type FmpDividend = {
  symbol: string;
  date?: string;
  recordDate?: string;
  paymentDate?: string;
  declarationDate?: string;
  adjDividend?: number;
  dividend?: number;
  yield?: number;
  frequency?: string;
};

export type FmpRatiosTtm = {
  symbol: string;
  priceToEarningsRatioTTM?: number;
  priceToBookRatioTTM?: number;
  priceToSalesRatioTTM?: number;
  priceToFreeCashFlowRatioTTM?: number;
  dividendYieldTTM?: number;
  dividendYieldPercentageTTM?: number;
  netProfitMarginTTM?: number;
  grossProfitMarginTTM?: number;
  currentRatioTTM?: number;
  debtToEquityRatioTTM?: number;
  returnOnEquityTTM?: number;
  returnOnAssetsTTM?: number;
  [key: string]: string | number | undefined;
};

export type FmpMetricsTtm = {
  symbol: string;
  marketCap?: number;
  enterpriseValueTTM?: number;
  evToEBITDATTM?: number;
  evToFreeCashFlowTTM?: number;
  returnOnEquityTTM?: number;
  returnOnInvestedCapitalTTM?: number;
  earningsYieldTTM?: number;
  freeCashFlowYieldTTM?: number;
  freeCashFlowToFirmTTM?: number;
  grahamNumberTTM?: number;
  [key: string]: string | number | undefined;
};

export type FmpCashFlow = {
  symbol: string;
  date?: string;
  fiscalYear?: string;
  period?: string;
  freeCashFlow?: number;
  operatingCashFlow?: number;
  capitalExpenditure?: number;
  interestExpense?: number;
};

export type FmpBalanceSheet = {
  symbol: string;
  date?: string;
  fiscalYear?: string;
  period?: string;
  cashAndCashEquivalents?: number;
  cashAndShortTermInvestments?: number;
  totalAssets?: number;
  totalDebt?: number;
  netDebt?: number;
  totalStockholdersEquity?: number;
  shortTermDebt?: number;
  longTermDebt?: number;
};

export type FmpEstimate = {
  symbol: string;
  date?: string;
  revenueAvg?: number;
  revenueLow?: number;
  revenueHigh?: number;
  epsAvg?: number;
  epsLow?: number;
  epsHigh?: number;
  ebitdaAvg?: number;
  netIncomeAvg?: number;
  numAnalystsRevenue?: number;
  numAnalystsEps?: number;
};

export type FmpEarnings = {
  symbol: string;
  date: string;
  epsActual?: number | null;
  epsEstimated?: number | null;
  revenueActual?: number | null;
  revenueEstimated?: number | null;
  lastUpdated?: string;
};

export type FmpPriceTarget = {
  symbol: string;
  targetHigh?: number;
  targetLow?: number;
  targetConsensus?: number;
  targetMedian?: number;
};

export type FmpRating = {
  symbol: string;
  rating?: string;
  overallScore?: number;
  discountedCashFlowScore?: number;
  returnOnEquityScore?: number;
  returnOnAssetsScore?: number;
  debtToEquityScore?: number;
  priceToEarningsScore?: number;
  priceToBookScore?: number;
};

export type FmpRiskPremium = {
  country: string;
  continent?: string;
  countryRiskPremium?: number;
  totalEquityRiskPremium?: number;
};

export type FmpEconPoint = {
  name?: string;
  date: string;
  value: number;
};

export type FmpEconEvent = {
  date: string;
  country?: string;
  event: string;
  currency?: string;
  previous?: number | null;
  estimate?: number | null;
  actual?: number | null;
  impact?: string;
  change?: number | null;
  changePercentage?: number | null;
  unit?: string;
};

export const ALLOWED_FMP_PATHS = [
  "quote",
  "quote-short",
  "batch-quote",
  "search-symbol",
  "search-name",
  "profile",
  "historical-price-eod/light",
  "key-metrics-ttm",
  "ratios-ttm",
  "discounted-cash-flow",
  "financial-scores",
  "company-screener",
  "biggest-gainers",
  "biggest-losers",
  "most-actives",
  "sector-performance-snapshot",
  "treasury-rates",
  "news/stock-latest",
  "news/stock",
  "exchange-market-hours",
  "stock-price-change",
  "stock-peers",
  "income-statement",
  "cash-flow-statement",
  "balance-sheet-statement",
  "dividends",
  "economic-indicators",
  "economic-calendar",
  "analyst-estimates",
  "earnings",
  "earnings-calendar",
  "price-target-consensus",
  "ratings-snapshot",
  "market-risk-premium",
] as const;

export type AllowedFmpPath = (typeof ALLOWED_FMP_PATHS)[number];
