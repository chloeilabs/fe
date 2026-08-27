"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DeltaFromPercent } from "@/components/delta";
import { Kpi } from "@/components/kpi";
import { SymbolSearch } from "@/components/symbol-search";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ASSET_CLASS_LABELS, classWeights, type AssetClass } from "@/lib/engine/allocation";
import { fireNumber, futureValue, yearsToTarget } from "@/lib/engine/wealth";
import { money, num } from "@/lib/format";
import { ClientOnly } from "@/lib/hooks/use-mounted";
import { useQuotes } from "@/lib/hooks/use-quotes";
import { usePortfolio } from "@/lib/portfolio/store";

const INDEXES = ["^GSPC", "^DJI", "^IXIC", "^VIX"];
const COLORS = ["#d4b483", "#8fbf9f", "#7ea0b7", "#c98b6a", "#b7a0c9", "#9aa0a6", "#e2d6c2"];

export function DashboardView() {
  const { state, ready } = usePortfolio();
  const symbols = [...state.holdings.map((h) => h.symbol), ...state.watchlist, ...INDEXES];
  const { quotes } = useQuotes(symbols);

  const rows = state.holdings.map((h) => {
    const price = quotes[h.symbol]?.price ?? h.costPerShare;
    const value = h.shares * price;
    const cost = h.shares * h.costPerShare;
    const day = quotes[h.symbol]?.changePercentage ?? 0;
    return { ...h, price, value, cost, pnl: value - cost, day };
  });
  const invested = rows.reduce((s, r) => s + r.value, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const netWorth = invested + state.cash;
  const dayPnl = rows.reduce((s, r) => s + r.value * ((r.day ?? 0) / 100), 0);
  const weights = classWeights([
    ...rows.map((r) => ({ assetClass: r.assetClass as AssetClass, value: r.value })),
    { assetClass: "cash", value: state.cash },
  ]);
  const pie = (Object.entries(weights) as [AssetClass, number][])
    .filter(([, w]) => w > 0.001)
    .map(([key, w]) => ({ name: ASSET_CLASS_LABELS[key], value: w }));

  const fire = fireNumber(state.goals.annualSpend, state.goals.safeWithdrawalRate);
  const years = yearsToTarget({
    presentValue: netWorth,
    monthlyContribution: state.goals.monthlyContribution,
    annualReturn: state.goals.expectedReturn,
    inflation: state.goals.inflation,
    target: fire,
    contributionGrowth: state.goals.contributionGrowth,
  });
  const atRetire = futureValue({
    presentValue: netWorth,
    monthlyContribution: state.goals.monthlyContribution,
    annualReturn: state.goals.expectedReturn,
    inflation: state.goals.inflation,
    years: Math.max(0, state.goals.retirementAge - state.goals.currentAge),
    contributionGrowth: state.goals.contributionGrowth,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Personal compounding desk</p>
          <h1 className="font-heading text-4xl tracking-tight">The book, the plan, the tape.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Track what you own, engineer the savings rate that actually gets you there, and interrogate securities with Financial Modeling Prep data.
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
          label="Today"
          value={money(dayPnl)}
          hint={<DeltaFromPercent value={invested ? (dayPnl / invested) * 100 : 0} />}
        />
        <Kpi
          label="Years to FIRE"
          value={years == null ? "80+" : num(years, 1)}
          hint={`${money(fire, true)} nest egg at ${num(state.goals.safeWithdrawalRate * 100, 1)}% SWR`}
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
                    <TableCell className="text-right font-mono tabular-nums">{money(row.pnl)}</TableCell>
                    <TableCell className="text-right">
                      <DeltaFromPercent value={row.day} />
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
              <CardDescription>Versus your target mix on the Plan page.</CardDescription>
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
              <CardTitle>Retirement path</CardTitle>
              <CardDescription>
                At {state.goals.retirementAge}, real wealth ≈ {money(atRetire, true)} vs a {money(fire, true)} FIRE number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (netWorth / fire) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {num((netWorth / fire) * 100, 1)}% of the nest egg funded today.
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
