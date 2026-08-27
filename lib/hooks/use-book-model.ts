"use client";

import { useEffect, useMemo, useState } from "react";

import { annualizeAlpha, capm } from "@/lib/engine/capm";
import {
  covToCorr,
  ewmaCovariance,
  ewmaVariance,
  toReturnMatrix,
} from "@/lib/engine/covariance";
import {
  globalMinVariance,
  packAnnual,
  portfolioMoments,
} from "@/lib/engine/optimize";
import { pcaFactors } from "@/lib/engine/pca";
import {
  alignedReturns,
  annualizedReturn,
  annualizedVol,
  portfolioReturns,
  sharpeRatio,
} from "@/lib/engine/risk";
import { stdev } from "@/lib/engine/stats";
import {
  cornishFisherVaR,
  historicalVaR,
  parametricVaR,
} from "@/lib/engine/var";
import { fetchFmp } from "@/lib/fmp/browser";
import type { FmpLightBar } from "@/lib/fmp/types";
import { useQuotes } from "@/lib/hooks/use-quotes";
import { usePortfolio } from "@/lib/portfolio/store";

export const MARKET = "SPY";
const RF = 0.043;

export function useBookModel() {
  const { state, ready, setHoldings } = usePortfolio();
  const holdingSymbols = useMemo(
    () => [...new Set(state.holdings.map((h) => h.symbol))],
    [state.holdings],
  );
  const symbols = useMemo(
    () => [...new Set([...holdingSymbols, MARKET])],
    [holdingSymbols],
  );
  const { quotes, loading: quotesLoading, error: quoteError, mode } = useQuotes(symbols);
  const key = symbols.join(",");
  const [bundle, setBundle] = useState<{
    key: string;
    series: Record<string, FmpLightBar[]>;
    error: string | null;
  }>({ key: "", series: {}, error: null });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(
      symbols.map((symbol) =>
        fetchFmp<FmpLightBar[]>("historical-price-eod/light", { symbol }),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const series: Record<string, FmpLightBar[]> = {};
        symbols.forEach((symbol, i) => {
          series[symbol] = results[i]?.data ?? [];
        });
        setBundle({ key, series, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setBundle({ key, series: {}, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [key, symbols]);

  const valued = useMemo(
    () =>
      state.holdings.map((h) => {
        const price = quotes[h.symbol]?.price ?? h.costPerShare;
        return { ...h, price, value: h.shares * price };
      }),
    [quotes, state.holdings],
  );
  const invested = valued.reduce((s, h) => s + h.value, 0);

  const names = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of valued) {
      if (h.value <= 0) continue;
      map.set(h.symbol, (map.get(h.symbol) ?? 0) + h.value);
    }
    return [...map.keys()];
  }, [valued]);

  const weights = useMemo(
    () =>
      names.map((symbol) => {
        const value = valued
          .filter((h) => h.symbol === symbol)
          .reduce((s, h) => s + h.value, 0);
        return invested > 0 ? value / invested : 0;
      }),
    [invested, names, valued],
  );

  const weightMap = useMemo(
    () => Object.fromEntries(names.map((s, i) => [s, weights[i] ?? 0])),
    [names, weights],
  );

  const analytics = useMemo(() => {
    const { dates, returns } = alignedReturns(
      Object.fromEntries(symbols.map((s) => [s, bundle.series[s] ?? []])),
    );
    const matrix = toReturnMatrix(returns, names);
    const packed =
      matrix.length > 2
        ? packAnnual(matrix)
        : {
            mu: names.map(() => 0),
            cov: names.map(() => names.map(() => 0)),
            sample: names.map(() => names.map(() => 0)),
            shrink: 0,
          };
    const port = portfolioReturns(weightMap, returns);
    const market = returns[MARKET] ?? [];
    const n = Math.min(port.length, market.length);
    const portClip = port.slice(0, n);
    const mktClip = market.slice(0, n);
    const ewmaDaily = matrix.length > 1 ? ewmaCovariance(matrix) : packed.cov;
    const moments =
      names.length && packed.cov.length
        ? portfolioMoments(weights, packed.mu, packed.cov, RF)
        : { expectedReturn: 0, volatility: 0, sharpe: 0 };
    const gmv =
      packed.cov.length && names.length
        ? globalMinVariance(packed.cov, true)
        : [];
    const gmvTurnover =
      0.5 *
      gmv.reduce((s, w, i) => s + Math.abs(w - (weights[i] ?? 0)), 0);
    const hist = historicalVaR(portClip, 0.95);
    const param = parametricVaR(portClip, 0.95);
    const cf = cornishFisherVaR(portClip, 0.95);
    const hist99 = historicalVaR(portClip, 0.99);
    const bookCapm = capm(portClip, mktClip);
    const nameCapm = names.map((symbol) => ({
      symbol,
      ...capm(returns[symbol] ?? [], mktClip),
      alphaAnn: annualizeAlpha(capm(returns[symbol] ?? [], mktClip).alpha),
      vol: annualizedVol(returns[symbol] ?? []),
    }));
    const pca = packed.cov.length ? pcaFactors(packed.cov) : null;
    const corr = covToCorr(packed.cov);
    const te =
      n > 2
        ? stdev(
            portClip.map((r, i) => r - (mktClip[i] ?? 0)),
            true,
          ) * Math.sqrt(252)
        : 0;
    return {
      dates,
      returns,
      matrix,
      packed,
      port: portClip,
      market: mktClip,
      ewmaDaily,
      ewmaVol: Math.sqrt(Math.max(ewmaVariance(portClip), 0)) * Math.sqrt(252),
      moments,
      gmv,
      gmvTurnover,
      hist,
      param,
      cf,
      hist99,
      bookCapm,
      nameCapm,
      pca,
      corr,
      te,
      sharpe: sharpeRatio(portClip, RF),
      annReturn: annualizedReturn(portClip),
      annVol: annualizedVol(portClip),
    };
  }, [bundle.series, names, symbols, weightMap, weights]);

  return {
    ready: ready && bundle.key === key && !quotesLoading,
    loading: Boolean(key) && (quotesLoading || bundle.key !== key),
    error: bundle.error ?? quoteError,
    mode,
    state,
    quotes,
    valued,
    invested,
    cash: state.cash,
    netWorth: invested + state.cash,
    names,
    weights,
    weightMap,
    setHoldings,
    ...analytics,
  };
}
