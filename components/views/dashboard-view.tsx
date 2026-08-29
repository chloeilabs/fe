"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DeltaFromPercent } from "@/components/delta";
import { Kpi } from "@/components/kpi";
import { SymbolSearch } from "@/components/symbol-search";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ASSET_CLASS_LABELS, classWeights, type AssetClass } from "@/lib/engine/allocation";
import { fetchFmpOptional } from "@/lib/fmp/browser";
import type { FmpDividend } from "@/lib/fmp/types";
import { money, num, pct } from "@/lib/format";
import { useBookModel } from "@/lib/hooks/use-book-model";
import { ClientOnly } from "@/lib/hooks/use-mounted";
import { useQuotes } from "@/lib/hooks/use-quotes";
import { usePortfolio } from "@/lib/portfolio/store";

const INDEXES = ["^GSPC", "^DJI", "^IXIC", "^VIX"];
const COLORS = ["#d4b483", "#8fbf9f", "#7ea0b7", "#c98b6a", "#b7a0c9", "#9aa0a6", "#e2d6c2"];

export function DashboardView() {
  const { state, ready } = usePortfolio();
  const extra = [...state.watchlist, ...INDEXES];
  const { quotes: extraQuotes } = useQuotes(extra);
  const book = useBookModel();
  const quotes = { ...extraQuotes, ...book.quotes };

  const rows = book.valued;
  const invested = book.invested;
  const cost = rows.reduce((s, r) => s + r.shares * r.costPerShare, 0);
  const netWorth = book.netWorth;
  const dayPnl = rows.reduce((s, r) => s + r.value * ((quotes[r.symbol]?.changePercentage ?? 0) / 100), 0);
  const weights = classWeights([
    ...rows.map((r) => ({ assetClass: r.assetClass as AssetClass, value: r.value })),
    { assetClass: "cash", value: state.cash },
  ]);
  const pie = (Object.entries(weights) as [AssetClass, number][])
    .filter(([, w]) => w > 0.001)
    .map(([key, w]) => ({ name: ASSET_CLASS_LABELS[key], value: w }));
  const dollarVar = (book.hist.var ?? 0) * invested;
  const [divs, setDivs] = useState<FmpDividend[]>([]);
  const held = new Set(rows.map((r) => r.symbol));

  useEffect(() => {
    const from = new Date();
    const to = new Date();
    to.setUTCDate(to.getUTCDate() + 45);
    from.setUTCDate(from.getUTCDate() - 3);
    fetchFmpOptional<FmpDividend[]>("dividends-calendar", {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }).then((rows) => setDivs(rows ?? []));
  }, []);
  const bookDivs = divs.filter((d) => held.has(d.symbol)).slice(0, 6);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Quantitative desk</p>
          <h1 className="font-heading text-4xl tracking-tight">The book, the covariance, the tape.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Mark-to-market on Financial Modeling Prep, then mean-variance, VaR, and CAPM on the same return histories.
          </p>
        </div>
        <SymbolSearch />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Net worth" value={money(netWorth)} hint={`${money(state.cash)} cash`} />
        <Kpi
          label="Unrealized P/L"
          value={money(invested - cost)}
          hint={<DeltaFromPercent value={cost ? ((invested - cost) / cost) * 100 : 0} />}
        />
        <Kpi
          label="Sharpe"
          value={num(book.sharpe, 2)}
          hint={`σ ${pct(book.annVol, false)} · TE vs SPY ${pct(book.te, false)}`}
        />
        <Kpi
          label="95% hist. VaR"
          value={money(dollarVar)}
          hint={`Daily loss ${pct(book.hist.var, false)} · CVaR ${pct(book.hist.cvar, false)}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>Marked to FMP last price. Seed book is local to this browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead className="text-right">Day</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/research/${row.symbol}`} className="font-mono hover:underline">
                        {row.symbol}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.name}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{money(row.value)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{money(row.value - row.shares * row.costPerShare)}</TableCell>
                    <TableCell className="text-right">
                      <DeltaFromPercent value={quotes[row.symbol]?.changePercentage} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!ready ? <p className="pt-3 text-xs text-muted-foreground">Loading book…</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
              <CardDescription>Asset-class mix. Security-level GMV lives on Optimize.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="h-40 w-40">
                <ClientOnly fallback={<div className="h-40 w-40 rounded-full bg-muted/40" />}>
                <ResponsiveContainer initialDimension={{ width: 160, height: 160 }}>
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} stroke="none">
                      {pie.map((entry, i) => (
                        <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                </ClientOnly>
              </div>
              <ul className="space-y-1 text-sm">
                {pie.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {p.name}
                    <span className="ml-auto font-mono tabular-nums">{num(p.value * 100, 0)}%</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming dividends</CardTitle>
              <CardDescription>FMP dividends-calendar on names in the book.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {bookDivs.length === 0 ? (
                <p className="text-muted-foreground">No book ex-dates in the next 45 days.</p>
              ) : (
                bookDivs.map((row, i) => (
                  <div key={`${row.symbol}-${row.date}-${i}`} className="flex justify-between gap-3">
                    <Link href={`/research/${row.symbol}`} className="font-mono hover:text-primary">
                      {row.symbol}
                    </Link>
                    <span className="font-mono text-muted-foreground">{row.date}</span>
                    <span className="font-mono">{num(row.adjDividend ?? row.dividend, 2)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distance to GMV</CardTitle>
              <CardDescription>
                One-way turnover to the long-only global minimum-variance book is {pct(book.gmvTurnover, false)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, book.gmvTurnover * 200)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Today {money(dayPnl)} on the session.{" "}
                <Link href="/optimize" className="underline underline-offset-4">
                  Run the optimizer
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tape</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {INDEXES.map((sym) => {
              const q = quotes[sym];
              return (
                <div key={sym} className="rounded-lg bg-muted/40 p-3">
                  <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{q?.name ?? sym}</div>
                  <div className="font-mono text-lg tabular-nums">{q ? num(q.price, 2) : "—"}</div>
                  <DeltaFromPercent value={q?.changePercentage} />
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Watchlist</CardTitle>
            <Badge variant="outline">{state.watchlist.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.watchlist.map((sym) => {
              const q = quotes[sym];
              return (
                <Link key={sym} href={`/research/${sym}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="font-mono">{sym}</span>
                  <span className="flex items-center gap-3 font-mono text-sm tabular-nums">
                    {q ? money(q.price) : "—"}
                    <DeltaFromPercent value={q?.changePercentage} />
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
