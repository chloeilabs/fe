import "server-only";

import {
  sampleBalanceSheet,
  sampleCashFlow,
  sampleDcf,
  sampleDividends,
  sampleEtfCountries,
  sampleEtfHoldings,
  sampleEtfInfo,
  sampleEtfSectors,
  sampleEnterpriseValues,
  sampleFullHistory,
  sampleGrades,
  sampleGeographicRevenue,
  sampleHistoricalMarketCap,
  sampleIndustryPe,
  sampleIndustryPerf,
  samplePriceTargetSummary,
  sampleProductRevenue,
  sampleSharesFloat,
  sampleDividendsCalendar,
  sampleGrowth,
  sampleKeyMetrics,
  sampleOwnerEarnings,
  sampleSectorPe,
  sampleEarnings,
  sampleEarningsCalendar,
  sampleEconCalendar,
  sampleEconIndicator,
  sampleEstimates,
  sampleHistory,
  sampleHours,
  sampleIncome,
  sampleMetrics,
  sampleMovers,
  sampleNews,
  samplePeers,
  samplePriceChange,
  samplePriceTarget,
  sampleProfile,
  sampleQuote,
  sampleQuotes,
  sampleRating,
  sampleRatios,
  sampleRiskPremium,
  sampleScores,
  sampleScreener,
  sampleSearch,
  sampleSectors,
  sampleTreasury,
} from "@/lib/fmp/sample";
import { ALLOWED_FMP_PATHS, type AllowedFmpPath } from "@/lib/fmp/types";

const BASE = "https://financialmodelingprep.com/stable";

export class FmpError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function hasFmpKey() {
  return Boolean(process.env.FMP_API_KEY?.trim());
}

export function isAllowedPath(path: string): path is AllowedFmpPath {
  return (ALLOWED_FMP_PATHS as readonly string[]).includes(path);
}

function cacheSeconds(path: string) {
  if (path === "quote" || path === "batch-quote" || path === "quote-short") return 30;
  if (path.startsWith("news") || path.includes("biggest") || path === "most-actives") return 120;
  if (path.includes("historical")) return 3600;
  return 300;
}

function fromSample(path: AllowedFmpPath, params: Record<string, string>): unknown {
  const symbol = params.symbol?.toUpperCase();
  const symbols = (params.symbols ?? symbol ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  switch (path) {
    case "quote":
    case "quote-short":
      return symbol ? [sampleQuote(symbol)].filter(Boolean) : sampleQuotes(symbols);
    case "batch-quote":
      return sampleQuotes(symbols);
    case "search-symbol":
    case "search-name":
      return sampleSearch(params.query ?? "");
    case "profile":
      return symbol ? [sampleProfile(symbol)].filter(Boolean) : [];
    case "historical-price-eod/light":
      return symbol ? sampleHistory(symbol) : [];
    case "historical-price-eod/full":
      return symbol ? sampleFullHistory(symbol) : [];
    case "key-metrics-ttm":
      return symbol ? [sampleMetrics(symbol)].filter(Boolean) : [];
    case "ratios-ttm":
      return symbol ? [sampleRatios(symbol)].filter(Boolean) : [];
    case "discounted-cash-flow":
      return symbol ? [sampleDcf(symbol)].filter(Boolean) : [];
    case "financial-scores":
      return symbol ? [sampleScores(symbol)].filter(Boolean) : [];
    case "company-screener":
      return filterScreener(sampleScreener(), params);
    case "biggest-gainers":
      return sampleMovers("gainers");
    case "biggest-losers":
      return sampleMovers("losers");
    case "most-actives":
      return sampleMovers("actives");
    case "sector-performance-snapshot":
      return sampleSectors();
    case "treasury-rates":
      return [sampleTreasury()];
    case "news/stock-latest":
      return sampleNews();
    case "news/stock": {
      const list = (params.symbols ?? symbol ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return list.flatMap((s) => sampleNews(s)).slice(0, 16);
    }
    case "exchange-market-hours":
      return [sampleHours()];
    case "stock-price-change":
      return symbol ? [samplePriceChange(symbol)].filter(Boolean) : [];
    case "stock-peers":
      return symbol ? samplePeers(symbol) : [];
    case "income-statement":
      return symbol ? sampleIncome(symbol) : [];
    case "cash-flow-statement":
      return symbol ? sampleCashFlow(symbol) : [];
    case "balance-sheet-statement":
      return symbol ? sampleBalanceSheet(symbol) : [];
    case "dividends":
      return symbol ? sampleDividends(symbol) : [];
    case "owner-earnings":
      return symbol ? sampleOwnerEarnings(symbol) : [];
    case "grades-consensus":
      return symbol ? [sampleGrades(symbol)].filter(Boolean) : [];
    case "key-metrics":
      return symbol ? sampleKeyMetrics(symbol) : [];
    case "financial-growth":
      return symbol ? sampleGrowth(symbol) : [];
    case "etf/holdings":
      return symbol ? sampleEtfHoldings(symbol) : [];
    case "etf/info":
      return symbol ? [sampleEtfInfo(symbol)].filter(Boolean) : [];
    case "etf/sector-weightings":
      return symbol ? sampleEtfSectors(symbol) : [];
    case "etf/country-weightings":
      return symbol ? sampleEtfCountries(symbol) : [];
    case "sector-pe-snapshot":
      return sampleSectorPe();
    case "industry-pe-snapshot":
      return sampleIndustryPe();
    case "shares-float":
      return symbol ? [sampleSharesFloat(symbol)].filter(Boolean) : [];
    case "enterprise-values":
      return symbol ? sampleEnterpriseValues(symbol) : [];
    case "levered-discounted-cash-flow": {
      const row = symbol ? sampleDcf(symbol) : null;
      return row ? [{ ...row, dcf: row.dcf * 0.96 }] : [];
    }
    case "dividends-calendar":
      return sampleDividendsCalendar();
    case "price-target-summary":
      return symbol ? [samplePriceTargetSummary(symbol)].filter(Boolean) : [];
    case "revenue-geographic-segmentation":
      return symbol ? sampleGeographicRevenue(symbol) : [];
    case "revenue-product-segmentation":
      return symbol ? sampleProductRevenue(symbol) : [];
    case "historical-market-capitalization":
      return symbol ? sampleHistoricalMarketCap(symbol, Number(params.limit) || 260) : [];
    case "industry-performance-snapshot":
      return sampleIndustryPerf();
    case "economic-indicators":
      return sampleEconIndicator(params.name ?? "CPI");
    case "economic-calendar":
      return sampleEconCalendar();
    case "analyst-estimates":
      return symbol ? sampleEstimates(symbol) : [];
    case "earnings":
      return symbol ? sampleEarnings(symbol) : [];
    case "earnings-calendar":
      return sampleEarningsCalendar();
    case "price-target-consensus":
      return symbol ? [samplePriceTarget(symbol)].filter(Boolean) : [];
    case "ratings-snapshot":
      return symbol ? [sampleRating(symbol)].filter(Boolean) : [];
    case "market-risk-premium":
      return sampleRiskPremium();
    default:
      return [];
  }
}

function filterScreener(rows: ReturnType<typeof sampleScreener>, params: Record<string, string>) {
  return rows.filter((row) => {
    if (params.sector && row.sector !== params.sector) return false;
    if (params.exchange && row.exchangeShortName !== params.exchange && row.exchange !== params.exchange) return false;
    if (params.country && row.country !== params.country) return false;
    if (params.isEtf === "false" && row.isEtf) return false;
    if (params.isEtf === "true" && !row.isEtf) return false;
    if (params.marketCapMoreThan && (row.marketCap ?? 0) < Number(params.marketCapMoreThan)) return false;
    if (params.marketCapLowerThan && (row.marketCap ?? Infinity) > Number(params.marketCapLowerThan)) return false;
    if (params.priceMoreThan && (row.price ?? 0) < Number(params.priceMoreThan)) return false;
    if (params.priceLowerThan && (row.price ?? Infinity) > Number(params.priceLowerThan)) return false;
    if (params.betaMoreThan && (row.beta ?? 0) < Number(params.betaMoreThan)) return false;
    if (params.betaLowerThan && (row.beta ?? Infinity) > Number(params.betaLowerThan)) return false;
    return true;
  });
}

export async function fmpFetch<T>(path: AllowedFmpPath, params: Record<string, string | number | boolean | undefined> = {}): Promise<{
  data: T;
  mode: "live" | "sample";
}> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    cleaned[key] = String(value);
  }

  const key = process.env.FMP_API_KEY?.trim();
  if (!key) {
    return { data: fromSample(path, cleaned) as T, mode: "sample" };
  }

  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(cleaned)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", key);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: cacheSeconds(path) },
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new FmpError(`FMP returned non-JSON for ${path}`, res.status);
  }

  if (!res.ok) {
    const message =
      typeof json === "object" && json && "Error Message" in json
        ? String((json as { "Error Message": string })["Error Message"])
        : `FMP request failed (${res.status})`;
    throw new FmpError(message, res.status);
  }

  if (json && typeof json === "object" && "Error Message" in json) {
    throw new FmpError(String((json as { "Error Message": string })["Error Message"]), 400);
  }

  return { data: json as T, mode: "live" };
}
