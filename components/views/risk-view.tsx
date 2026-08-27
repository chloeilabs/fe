"use client";

import { useEffect, useMemo, useState } from "react";

import { Kpi } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  alignedReturns,
  annualizedReturn,
  annualizedVol,
  betaVsMarket,
  calmarRatio,
  correlationMatrix,
  effectiveN,
  maxDrawdown,
  portfolioReturns,
  sharpeRatio,
  sortinoRatio,
} from "@/lib/engine/risk";
import { fetchFmp } from "@/lib/fmp/browser";
import type { FmpLightBar } from "@/lib/fmp/types";
import { num, pct } from "@/lib/format";
import { useQuotes } from "@/lib/hooks/use-quotes";
import { usePortfolio } from "@/lib/portfolio/store";

const MARKET = "SPY";

export function RiskView() {
  const { state } = usePortfolio();
  const symbols = useMemo(() => [...new Set([...state.holdings.map((h) => h.symbol), MARKET])], [state.holdings]);
  const { quotes } = useQuotes(symbols);
  const [series, setSeries] = useState<Record<string, FmpLightBar[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(symbols.map((symbol) => fetchFmp<FmpLightBar[]>("historical-price-eod/light", { symbol })))
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, FmpLightBar[]> = {};
        symbols.forEach((symbol, i) => {
          next[symbol] = results[i]?.data ?? [];
        });
        setSeries(next);
      })
      .catch((err: Error) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [symbols]);

  const valued = state.holdings.map((h) => ({
    ...h,
    value: h.shares * (quotes[h.symbol]?.price ?? h.costPerShare),
  }));
  const invested = valued.reduce((s, h) => s + h.value, 0);
  const weights = Object.fromEntries(valued.filter((h) => h.value > 0).map((h) => [h.symbol, h.value / invested]));
  const { returns } = alignedReturns({
    ...Object.fromEntries(symbols.map((s) => [s, series[s] ?? []])),
  });
  const port = portfolioReturns(weights, returns);
  const market = returns[MARKET] ?? [];
  const rf = 0.04;
  const wealthBars = port.reduce<{ date: string; price: number }[]>((acc, r, i) => {
    const prev = acc[acc.length - 1]?.price ?? 100;
    acc.push({ date: String(i), price: prev * (1 + r) });
    return acc;
  }, []);
  const dd = maxDrawdown(wealthBars);
  const corr = correlationMatrix(Object.fromEntries(Object.keys(weights).map((s) => [s, returns[s] ?? []])));
  const nEff = effectiveN(Object.values(weights));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Risk</p>
        <h1 className="font-heading text-4xl tracking-tight">How the book actually behaves</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Daily returns from FMP historical prices, value-weighted, versus SPY. Risk-free rate assumed 4% for Sharpe/Sortino.
        </p>
      </header>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ann. return" value={pct(annualizedReturn(port), true)} />
        <Kpi label="Ann. vol" value={pct(annualizedVol(port), false)} />
        <Kpi label="Sharpe" value={num(sharpeRatio(port, rf), 2)} hint={`Sortino ${num(sortinoRatio(port, rf), 2)}`} />
        <Kpi label="Max drawdown" value={pct(dd.maxDrawdown, true)} hint={`Beta vs SPY ${num(betaVsMarket(port, market), 2)} · Calmar ${num(calmarRatio(port, wealthBars), 2)}`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Diversification</CardTitle>
          <CardDescription>Effective number of bets from holdings weights: {num(nEff, 2)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Vol</TableHead>
                <TableHead className="text-right">Beta vs SPY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(weights).map((sym) => (
                <TableRow key={sym}>
                  <TableCell className="font-mono">{sym}</TableCell>
                  <TableCell className="text-right font-mono">{pct(weights[sym] ?? 0, false)}</TableCell>
                  <TableCell className="text-right font-mono">{pct(annualizedVol(returns[sym] ?? []), false)}</TableCell>
                  <TableCell className="text-right font-mono">{num(betaVsMarket(returns[sym] ?? [], market), 2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Correlation</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th />
                {corr.symbols.map((s) => (
                  <th key={s} className="px-2 py-1 font-mono">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corr.symbols.map((a, i) => (
                <tr key={a}>
                  <td className="px-2 py-1 font-mono">{a}</td>
                  {corr.matrix[i]!.map((v, j) => (
                    <td
                      key={`${a}-${j}`}
                      className="px-2 py-1 text-center font-mono"
                      style={{ background: `rgba(212,180,131,${Math.abs(v) * 0.45})` }}
                    >
                      {num(v, 2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
