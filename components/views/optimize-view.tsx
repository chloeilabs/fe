"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Kpi } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fractionalKelly } from "@/lib/engine/kelly";
import { wealthPaths } from "@/lib/engine/montecarlo";
import {
  blackLitterman,
  equalWeight,
  globalMinVariance,
  longOnlyFrontier,
  maxSharpe,
  resultOf,
  riskContributions,
  riskParity,
  scaleHoldingsToWeights,
  twoFundFrontier,
  type OptimizerKind,
} from "@/lib/engine/optimize";
import { money, num, pct } from "@/lib/format";
import { ClientOnly } from "@/lib/hooks/use-mounted";
import { useBookModel } from "@/lib/hooks/use-book-model";

const KINDS: { id: OptimizerKind | "current"; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "gmv", label: "GMV" },
  { id: "max-sharpe", label: "Max Sharpe" },
  { id: "erc", label: "ERC" },
  { id: "bl", label: "Black–Litterman" },
];

export function OptimizeView() {
  const book = useBookModel();
  const [rfPct, setRfPct] = useState(4.3);
  const [longOnly, setLongOnly] = useState(true);
  const [delta, setDelta] = useState(2.5);
  const [tau, setTau] = useState(0.05);
  const [kind, setKind] = useState<OptimizerKind | "current">("max-sharpe");
  const [years, setYears] = useState(5);
  const [nu, setNu] = useState(7);
  const [views, setViews] = useState<Record<string, { q: string; conf: string }>>({});

  const rf = rfPct / 100;
  const { names, weights, packed, invested, quotes, state } = book;
  const mu = packed.mu;
  const cov = packed.cov;

  const blViews = names.flatMap((symbol, asset) => {
    const raw = views[symbol]?.q;
    if (raw == null || raw === "") return [];
    const q = Number(raw) / 100;
    if (!Number.isFinite(q)) return [];
    const confidence = Math.min(Math.max(Number(views[symbol]?.conf || 0.5), 0.05), 0.99);
    return [{ asset, q, confidence }];
  });
  const viewKey = JSON.stringify(blViews);

  const strategies = useMemo(() => {
    if (!names.length || !cov.length) return [];
    const parsed = JSON.parse(viewKey) as { asset: number; q: number; confidence: number }[];
    const current = resultOf("equal", weights, mu, cov, rf);
    const gmv = resultOf("gmv", globalMinVariance(cov, longOnly), mu, cov, rf);
    const tangency = resultOf("max-sharpe", maxSharpe(mu, cov, rf, longOnly), mu, cov, rf);
    const erc = resultOf("erc", riskParity(cov), mu, cov, rf);
    const pi = blackLitterman(cov, weights, parsed, { delta, tau });
    const blMu = pi.map((x) => x + rf);
    const bl = resultOf("bl", maxSharpe(blMu, cov, rf, longOnly), blMu, cov, rf);
    return [
      { ...current, id: "current" as const, label: "Current", muUsed: mu },
      { ...gmv, id: "gmv" as const, label: "Global min variance", muUsed: mu },
      { ...tangency, id: "max-sharpe" as const, label: "Max Sharpe (tangency)", muUsed: mu },
      { ...erc, id: "erc" as const, label: "Equal risk contribution", muUsed: mu },
      { ...bl, id: "bl" as const, label: "Black–Litterman", muUsed: blMu, pi },
    ];
  }, [cov, delta, longOnly, mu, names.length, rf, tau, viewKey, weights]);

  const selected = strategies.find((s) => s.id === kind) ?? strategies[0];
  const frontier = useMemo(() => {
    if (!cov.length) return [];
    const pts = longOnly
      ? longOnlyFrontier(mu, cov, rf, 25).map((p) => ({ vol: p.vol, ret: p.ret, sharpe: p.sharpe }))
      : twoFundFrontier(mu, cov, rf, 41).map((p) => ({ vol: p.vol, ret: p.ret, sharpe: p.sharpe }));
    return [...pts].sort((a, b) => a.vol - b.vol);
  }, [cov, longOnly, mu, rf]);

  const rc = selected && cov.length ? riskContributions(selected.weights, cov) : [];
  const kelly = selected
    ? fractionalKelly(selected.expectedReturn - rf, selected.volatility ** 2, 0.5)
    : null;

  const mc = useMemo(() => {
    if (!selected || !cov.length || invested <= 0) return null;
    return wealthPaths({
      start: invested,
      mu,
      cov,
      weights: selected.weights,
      years,
      stepsPerYear: 12,
      paths: 400,
      nu,
      seed: 11,
    });
  }, [cov, invested, mu, nu, selected, years]);

  const chart = mc
    ? mc.quantiles.p50.map((_, i) => ({
        t: i / 12,
        p5: mc.quantiles.p5[i],
        p50: mc.quantiles.p50[i],
        p95: mc.quantiles.p95[i],
      }))
    : [];

  function applySelected() {
    if (!selected) return;
    const target = Object.fromEntries(names.map((s, i) => [s, selected.weights[i] ?? 0]));
    book.setHoldings(
      scaleHoldingsToWeights(
        state.holdings,
        (symbol) => quotes[symbol]?.price ?? state.holdings.find((h) => h.symbol === symbol)?.costPerShare ?? 0,
        target,
      ),
    );
    toast.success(`Rebalanced lots to ${selected.label} weights`);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Optimize</p>
        <h1 className="font-heading text-4xl tracking-tight">Mean-variance on the live book</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Ledoit–Wolf covariance, Markowitz GMV and tangency, Maillard–Roncalli ERC, Black–Litterman posterior
          returns, and a Student-t Monte Carlo. This is not a contribution planner.
        </p>
      </header>

      {book.error ? <p className="text-sm text-destructive">{book.error}</p> : null}
      {book.loading ? <p className="text-sm text-muted-foreground">Aligning FMP return histories…</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Shrinkage δ"
          value={num(packed.shrink, 3)}
          hint="Ledoit–Wolf intensity toward constant correlation"
        />
        <Kpi
          label="Current Sharpe"
          value={num(strategies.find((s) => s.id === "current")?.sharpe, 2)}
          hint={`E[r] ${pct(strategies.find((s) => s.id === "current")?.expectedReturn, true)} · σ ${pct(strategies.find((s) => s.id === "current")?.volatility, false)}`}
        />
        <Kpi
          label="Selected Sharpe"
          value={num(selected?.sharpe, 2)}
          hint={selected?.label}
        />
        <Kpi
          label="½-Kelly fraction"
          value={kelly ? num(kelly.f, 2) : "—"}
          hint={kelly ? `Full Kelly ${num(kelly.full, 2)} · g ${pct(kelly.growth, true)}` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solver</CardTitle>
          <CardDescription>
            Unconstrained GMV is w ∝ Σ⁻¹1. Tangency is w ∝ Σ⁻¹(μ − r_f 1). Long-only uses simplex projection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={kind === item.id ? "default" : "outline"}
                onClick={() => setKind(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Risk-free %">
              <Input type="number" step="0.1" value={rfPct} onChange={(e) => setRfPct(Number(e.target.value))} />
            </Field>
            <Field label="Risk aversion δ">
              <Input type="number" step="0.1" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
            </Field>
            <Field label="BL τ">
              <Input type="number" step="0.01" value={tau} onChange={(e) => setTau(Number(e.target.value))} />
            </Field>
            <Field label="Student-t ν">
              <Input type="number" step="1" value={nu} onChange={(e) => setNu(Number(e.target.value) || 7)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={longOnly}
              onChange={(e) => setLongOnly(e.target.checked)}
              className="size-4 accent-primary"
            />
            Long-only (project onto the simplex)
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Efficient frontier</CardTitle>
            <CardDescription>
              {longOnly
                ? "Long-only minimum-variance for a grid of target returns."
                : "Two-fund spanning: mixtures of GMV and the tangency portfolio."}{" "}
              Shrinkage {num(packed.shrink, 3)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
              <ResponsiveContainer initialDimension={{ width: 640, height: 280 }}>
                <LineChart data={frontier}>
                  <CartesianGrid strokeOpacity={0.12} />
                  <XAxis dataKey="vol" tickFormatter={(v) => pct(Number(v), false)} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => pct(Number(v), true)} tick={{ fontSize: 11 }} width={64} />
                  <Tooltip
                    formatter={(v, name) => [pct(Number(v), name !== "vol"), String(name)]}
                    labelFormatter={(_, pts) => `σ ${pct(Number(pts[0]?.payload?.vol), false)}`}
                  />
                  <Line type="monotone" dataKey="ret" stroke="#d4b483" dot={false} strokeWidth={1.8} name="E[r]" />
                </LineChart>
              </ResponsiveContainer>
            </ClientOnly>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Named portfolios</CardTitle>
            <CardDescription>Annualized moments on the shrunk covariance.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead className="text-right">E[r]</TableHead>
                  <TableHead className="text-right">σ</TableHead>
                  <TableHead className="text-right">Sharpe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {strategies.map((row) => (
                  <TableRow key={row.id} className={row.id === kind ? "bg-muted/40" : undefined}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right font-mono">{pct(row.expectedReturn, true)}</TableCell>
                    <TableCell className="text-right font-mono">{pct(row.volatility, false)}</TableCell>
                    <TableCell className="text-right font-mono">{num(row.sharpe, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Weights and dollar trades</CardTitle>
            <CardDescription>
              Trade = (w* − w) × invested {money(invested)}. Applying writes new share counts into the local book.
            </CardDescription>
          </div>
          <Button onClick={applySelected} disabled={!selected || !names.length}>
            Apply {selected?.label ?? "weights"}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Now</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">RC</TableHead>
                <TableHead className="text-right">Trade</TableHead>
                <TableHead>BL view (excess %)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {names.map((symbol, i) => {
                const target = selected?.weights[i] ?? 0;
                const now = weights[i] ?? 0;
                const trade = (target - now) * invested;
                return (
                  <TableRow key={symbol}>
                    <TableCell className="font-mono">{symbol}</TableCell>
                    <TableCell className="text-right font-mono">{pct(now, false)}</TableCell>
                    <TableCell className="text-right font-mono">{pct(target, false)}</TableCell>
                    <TableCell className="text-right font-mono">{pct(rc[i] ?? 0, false)}</TableCell>
                    <TableCell className="text-right font-mono">{money(trade)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Input
                          className="max-w-20"
                          placeholder="q %"
                          value={views[symbol]?.q ?? ""}
                          onChange={(e) =>
                            setViews((prev) => ({
                              ...prev,
                              [symbol]: { q: e.target.value, conf: prev[symbol]?.conf ?? "0.5" },
                            }))
                          }
                        />
                        <Input
                          className="max-w-16"
                          placeholder="c"
                          value={views[symbol]?.conf ?? ""}
                          onChange={(e) =>
                            setViews((prev) => ({
                              ...prev,
                              [symbol]: { q: prev[symbol]?.q ?? "", conf: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Equal-weight reference: {equalWeight(Math.max(names.length, 1)).map((w) => pct(w, false)).join(" · ")}.
            Views are absolute excess-return picks (P = e_i). Leave q blank for no view; posterior then equals π = δ Σ w.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Student-t wealth paths</CardTitle>
            <CardDescription>
              Elliptical t({nu}) shocks, shared χ², Cholesky of annual Σ scaled to months. Horizon {years}y on the
              selected weights. Median {money(mc?.terminal.p50, true)} · 5% {money(mc?.terminal.p5, true)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
              <ResponsiveContainer initialDimension={{ width: 560, height: 260 }}>
                <AreaChart data={chart}>
                  <CartesianGrid strokeOpacity={0.12} />
                  <XAxis dataKey="t" tickFormatter={(v) => `${num(Number(v), 0)}y`} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => money(Number(v), true)} tick={{ fontSize: 11 }} width={72} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Area type="monotone" dataKey="p95" stroke="transparent" fill="#d4b483" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="p5" stroke="transparent" fill="#0c0b09" fillOpacity={1} />
                  <Area type="monotone" dataKey="p50" stroke="#d4b483" fill="#d4b483" fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </ClientOnly>
            <div className="mt-3 max-w-40">
              <Label htmlFor="years">Horizon (years)</Label>
              <Input id="years" type="number" min={1} value={years} onChange={(e) => setYears(Number(e.target.value) || 1)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shrunk correlation</CardTitle>
            <CardDescription>Constant-correlation Ledoit–Wolf applied to aligned daily returns, then annualized.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th />
                  {names.map((s) => (
                    <th key={s} className="px-2 py-1 font-mono">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {names.map((a, i) => (
                  <tr key={a}>
                    <td className="px-2 py-1 font-mono">{a}</td>
                    {names.map((b, j) => {
                      const v = book.corr[i]?.[j] ?? 0;
                      return (
                        <td
                          key={`${a}-${b}`}
                          className="px-2 py-1 text-center font-mono"
                          style={{ background: `rgba(212,180,131,${Math.abs(v) * 0.45})` }}
                        >
                          {num(v, 2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
