"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Kpi } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ASSET_CLASS_LABELS,
  ASSET_CLASSES,
  type AssetClass,
} from "@/lib/engine/allocation";
import {
  CLASS_PROXIES,
  brinsonFromSlices,
  trailingCompound,
  type ClassBrinsonSlice,
} from "@/lib/engine/attribution";
import { walkForward } from "@/lib/engine/backtest";
import { curveConvexity, curveDuration, modifiedDuration } from "@/lib/engine/bonds";
import { logPrices, pairwiseCoint } from "@/lib/engine/coint";
import { annualizeVariance, fitGarch } from "@/lib/engine/garch";
import {
  curvePoints,
  fitNelsonSiegel,
  nsYield,
  treasuryToCurve,
} from "@/lib/engine/nelson-siegel";
import { portfolioReturns, sortedBars } from "@/lib/engine/risk";
import { fetchFmp, fetchFmpOptional } from "@/lib/fmp/browser";
import type { FmpEtfCountry, FmpEtfHolding, FmpEtfInfo, FmpEtfSector, FmpLightBar, FmpTreasury } from "@/lib/fmp/types";
import { money, num, parseWeightPct, pct } from "@/lib/format";
import { useBookModel } from "@/lib/hooks/use-book-model";
import { ClientOnly } from "@/lib/hooks/use-mounted";

const PROXY_SYMBOLS = ["VTI", "VXUS", "BND"] as const;
const BRINSON_WINDOW = 21;

export function LabView() {
  const book = useBookModel();
  const [treasury, setTreasury] = useState<FmpTreasury | null>(null);
  const [proxyReturns, setProxyReturns] = useState<Record<string, number[]>>({});
  const [etfInfo, setEtfInfo] = useState<FmpEtfInfo | null>(null);
  const [etfHoldings, setEtfHoldings] = useState<FmpEtfHolding[]>([]);
  const [etfSectors, setEtfSectors] = useState<FmpEtfSector[]>([]);
  const [etfCountries, setEtfCountries] = useState<FmpEtfCountry[]>([]);
  const etfSymbol = useMemo(() => {
    const etfs = book.valued.filter((h) => ["VTI", "VXUS", "BND", "SPY", "IWM"].includes(h.symbol));
    return [...etfs].sort((a, b) => b.value - a.value)[0]?.symbol ?? "VTI";
  }, [book.valued]);

  useEffect(() => {
    fetchFmp<FmpTreasury[]>("treasury-rates").then((res) => {
      setTreasury(res.data?.[0] ?? null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchFmpOptional<FmpEtfInfo[]>("etf/info", { symbol: etfSymbol }),
      fetchFmpOptional<FmpEtfHolding[]>("etf/holdings", { symbol: etfSymbol }),
      fetchFmpOptional<FmpEtfSector[]>("etf/sector-weightings", { symbol: etfSymbol }),
      fetchFmpOptional<FmpEtfCountry[]>("etf/country-weightings", { symbol: etfSymbol }),
    ]).then(([info, holds, sectors, countries]) => {
      if (cancelled) return;
      setEtfInfo(info?.[0] ?? null);
      setEtfHoldings((holds ?? []).slice(0, 8));
      setEtfSectors((sectors ?? []).slice(0, 8));
      setEtfCountries((countries ?? []).slice(0, 8));
    });
    return () => {
      cancelled = true;
    };
  }, [etfSymbol]);

  useEffect(() => {
    const missing = PROXY_SYMBOLS.filter((s) => !(book.returns[s]?.length));
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map((symbol) => fetchFmp<FmpLightBar[]>("historical-price-eod/light", { symbol })))
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, number[]> = {};
        missing.forEach((symbol, i) => {
          const bars = sortedBars(rows[i]?.data ?? []);
          const rs: number[] = [];
          for (let t = 1; t < bars.length; t += 1) {
            const prev = bars[t - 1]!.price;
            if (prev > 0) rs.push(bars[t]!.price / prev - 1);
          }
          next[symbol] = rs;
        });
        setProxyReturns(next);
      })
      .catch(() => {
        if (!cancelled) setProxyReturns({});
      });
    return () => {
      cancelled = true;
    };
  }, [book.returns]);

  const garch = useMemo(() => (book.port.length >= 20 ? fitGarch(book.port, 10) : null), [book.port]);
  const garchForecast = (garch?.forecast ?? []).map((v, i) => ({
    h: i + 1,
    vol: Math.sqrt(Math.max(annualizeVariance(v), 0)),
  }));

  const curve = useMemo(() => (treasury ? treasuryToCurve(treasury) : []), [treasury]);
  const ns = useMemo(
    () => (curve.length >= 4 ? fitNelsonSiegel(curve.map((c) => c.tau), curve.map((c) => c.yield)) : null),
    [curve],
  );
  const nsChart = useMemo(() => {
    if (!ns || !curve.length) return [];
    const dense = curvePoints(ns, curve.map((c) => c.tau));
    return curve.map((c, i) => ({
      tenor: c.tenor,
      observed: c.yield,
      fitted: dense[i]?.yield ?? nsYield(c.tau, ns.beta0, ns.beta1, ns.beta2, ns.lambda),
    }));
  }, [curve, ns]);

  const curveRisk = useMemo(() => {
    if (!curve.length) return null;
    const points = curve.map((c) => ({ tau: c.tau, yield: c.yield }));
    const y10raw = ns ? nsYield(10, ns.beta0, ns.beta1, ns.beta2, ns.lambda) : curve.find((c) => c.tau === 10)?.yield;
    const y10 = y10raw != null ? (y10raw > 2 ? y10raw / 100 : y10raw) : null;
    return {
      duration: curveDuration(points),
      convexity: curveConvexity(points),
      d10: y10 != null ? modifiedDuration(y10, 10) : null,
      y10,
    };
  }, [curve, ns]);

  const cointRows = useMemo(() => {
    const names = book.names.slice(0, 6);
    const series: Record<string, number[]> = {};
    for (const symbol of names) {
      const prices = sortedBars(book.series[symbol] ?? []).map((b) => b.price);
      series[symbol] = logPrices(prices);
    }
    return pairwiseCoint(series, names.filter((s) => (series[s]?.length ?? 0) > 30));
  }, [book.names, book.series]);

  const brinson = useMemo(() => {
    const nav = book.netWorth;
    if (nav <= 0) return null;
    const classOf = (symbol: string): AssetClass =>
      book.state.holdings.find((h) => h.symbol === symbol)?.assetClass ?? "other";
    const classValue = Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<AssetClass, number>;
    for (const h of book.valued) classValue[h.assetClass] += h.value;
    classValue.cash += book.cash;
    const slices: ClassBrinsonSlice[] = ASSET_CLASSES.map((id) => {
      const wP = classValue[id] / nav;
      const wB = book.state.target[id] ?? 0;
      const namesIn = book.names.filter((s) => classOf(s) === id);
      const sleeveValue = namesIn.reduce((sum, s) => {
        return sum + book.valued.filter((h) => h.symbol === s).reduce((acc, h) => acc + h.value, 0);
      }, 0);
      let rP = 0;
      if (id !== "cash" && sleeveValue > 0) {
        const w: Record<string, number> = {};
        for (const s of namesIn) {
          const v = book.valued.filter((h) => h.symbol === s).reduce((acc, h) => acc + h.value, 0);
          w[s] = v / sleeveValue;
        }
        rP = trailingCompound(portfolioReturns(w, book.returns), BRINSON_WINDOW);
      }
      const proxy = CLASS_PROXIES[id];
      const benchSeries = proxy ? (book.returns[proxy] ?? proxyReturns[proxy]) : undefined;
      const rB = benchSeries?.length ? trailingCompound(benchSeries, BRINSON_WINDOW) : rP;
      return { id, wP, wB, rP, rB };
    });
    return { slices, result: brinsonFromSlices(slices) };
  }, [book.cash, book.names, book.netWorth, book.returns, book.state, book.valued, proxyReturns]);

  const wf = useMemo(
    () => (book.matrix.length > 80 && (book.matrix[0]?.length ?? 0) > 0 ? walkForward(book.matrix, 60) : null),
    [book.matrix],
  );
  const wfChart = useMemo(() => {
    const pts = wf?.points ?? [];
    const step = Math.max(1, Math.floor(pts.length / 140));
    return pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => ({
      t: p.t,
      ew: p.ew,
      gmv: p.gmv,
      sharpe: p.sharpe,
      erc: p.erc,
    }));
  }, [wf]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Lab</p>
        <h1 className="font-heading text-4xl tracking-tight">Engines on the live book</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          GARCH(1,1) on the value-weighted book, Nelson–Siegel plus zero-coupon duration/convexity on the Treasury
          curve, Engle–Granger on log prices (with last z), Brinson–Fachler versus your policy mix, a walk-forward of
          EW / GMV / max-Sharpe / ERC, and ETF look-through including country weights.
        </p>
      </header>
      {book.error ? <p className="text-sm text-destructive">{book.error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="GARCH persistence"
          value={garch ? num(garch.persistence, 3) : "—"}
          hint={garch ? `α ${num(garch.alpha, 2)} · β ${num(garch.beta, 2)}` : "Need 20+ daily returns"}
        />
        <Kpi
          label="NS RMSE"
          value={ns ? num(ns.rmse, 3) : "—"}
          hint={
            curveRisk
              ? `10y D_mod ${num(curveRisk.d10, 2)} · curve D ${num(curveRisk.duration, 2)}`
              : "Waiting on treasury-rates"
          }
        />
        <Kpi
          label="Cointegrated pairs"
          value={String(cointRows.filter((r) => r.result.cointegrated).length)}
          hint={`MacKinnon 5% · ${cointRows.length} tested`}
        />
        <Kpi
          label="Brinson active"
          value={brinson ? pct(brinson.result.active, true) : "—"}
          hint={brinson ? `${BRINSON_WINDOW}d vs policy + proxies` : "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>GARCH(1,1) variance targeting</CardTitle>
            <CardDescription>
              ω = (1 − α − β) σ̄², QMLE on a coarse (α, β) grid. Unconditional vol{" "}
              {garch ? pct(Math.sqrt(annualizeVariance(garch.unconditional)), false) : "—"} · last{" "}
              {garch ? pct(Math.sqrt(annualizeVariance(garch.lastVariance)), false) : "—"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
              <ResponsiveContainer initialDimension={{ width: 480, height: 220 }}>
                <LineChart data={garchForecast}>
                  <XAxis dataKey="h" tickFormatter={(v) => `${v}d`} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => pct(Number(v), false)} tick={{ fontSize: 11 }} width={56} />
                  <Tooltip formatter={(v) => pct(Number(v), false)} />
                  <Line type="monotone" dataKey="vol" stroke="#d4b483" dot={false} strokeWidth={1.6} />
                </LineChart>
              </ResponsiveContainer>
            </ClientOnly>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nelson–Siegel</CardTitle>
            <CardDescription>
              Diebold–Li grid on λ, OLS on the loadings. Level β0 {ns ? num(ns.beta0, 2) : "—"} · slope β1{" "}
              {ns ? num(ns.beta1, 2) : "—"} · curvature β2 {ns ? num(ns.beta2, 2) : "—"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
              <ResponsiveContainer initialDimension={{ width: 480, height: 220 }}>
                <LineChart data={nsChart}>
                  <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip />
                  <Line type="monotone" dataKey="observed" stroke="#d4b483" strokeWidth={1.6} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="fitted" stroke="#8a9ba8" strokeWidth={1.4} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ClientOnly>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Engle–Granger cointegration</CardTitle>
          <CardDescription>
            OLS hedge on log prices, then Dickey–Fuller on residuals. Cointegrated if ADF &lt; −3.34 (MacKinnon 5% with
            a constant). Half-life from residual AR(1).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cointRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Need at least two names with overlapping price history.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">β</TableHead>
                  <TableHead className="text-right">ADF</TableHead>
                  <TableHead className="text-right">Half-life</TableHead>
                  <TableHead className="text-right">σ(e)</TableHead>
                  <TableHead className="text-right">z</TableHead>
                  <TableHead className="text-right">5%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cointRows.map((row) => (
                  <TableRow key={`${row.a}-${row.b}`}>
                    <TableCell className="font-mono">
                      {row.a} / {row.b}
                    </TableCell>
                    <TableCell className="text-right font-mono">{num(row.result.beta, 3)}</TableCell>
                    <TableCell className="text-right font-mono">{num(row.result.adf, 2)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number.isFinite(row.result.halfLife) ? `${num(row.result.halfLife, 1)}d` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{num(row.result.residualVol, 4)}</TableCell>
                    <TableCell className="text-right font-mono">{num(row.result.lastZ, 2)}</TableCell>
                    <TableCell className="text-right">{row.result.cointegrated ? "reject" : "fail"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brinson–Fachler vs policy</CardTitle>
          <CardDescription>
            R_p − R_b = allocation + selection + interaction on {BRINSON_WINDOW}-day compounded class returns. Benchmark
            sleeves use VTI / VXUS / BND (and 0 for cash). Weights are current book vs Settings-stored target.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Allocation" value={brinson ? pct(brinson.result.allocation, true) : "—"} />
            <Kpi label="Selection" value={brinson ? pct(brinson.result.selection, true) : "—"} />
            <Kpi label="Interaction" value={brinson ? pct(brinson.result.interaction, true) : "—"} />
            <Kpi
              label="Active"
              value={brinson ? pct(brinson.result.active, true) : "—"}
              hint={
                brinson
                  ? `Book ${pct(brinson.result.portfolio, true)} · policy ${pct(brinson.result.benchmark, true)}`
                  : undefined
              }
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">w_p</TableHead>
                <TableHead className="text-right">w_b</TableHead>
                <TableHead className="text-right">r_p</TableHead>
                <TableHead className="text-right">r_b</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(brinson?.slices ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{ASSET_CLASS_LABELS[s.id as AssetClass] ?? s.id}</TableCell>
                  <TableCell className="text-right font-mono">{pct(s.wP, false)}</TableCell>
                  <TableCell className="text-right font-mono">{pct(s.wB, false)}</TableCell>
                  <TableCell className="text-right font-mono">{pct(s.rP, true)}</TableCell>
                  <TableCell className="text-right font-mono">{pct(s.rB, true)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Walk-forward optimizer</CardTitle>
          <CardDescription>
            Expanding 60-day Ledoit–Wolf window, long-only GMV / max-Sharpe / ERC vs equal weight, applied to the next
            daily book return. Terminal wealth (start = 1): EW {wf ? num(wf.terminal.ew, 3) : "—"} · GMV{" "}
            {wf ? num(wf.terminal.gmv, 3) : "—"} · Sharpe {wf ? num(wf.terminal.sharpe, 3) : "—"} · ERC{" "}
            {wf ? num(wf.terminal.erc, 3) : "—"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
            <ResponsiveContainer initialDimension={{ width: 800, height: 260 }}>
              <LineChart data={wfChart}>
                <XAxis dataKey="t" hide />
                <YAxis tickFormatter={(v) => num(Number(v), 2)} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v) => num(Number(v), 3)} />
                <Line type="monotone" dataKey="ew" name="EW" stroke="#8a9ba8" dot={false} strokeWidth={1.2} />
                <Line type="monotone" dataKey="gmv" name="GMV" stroke="#d4b483" dot={false} strokeWidth={1.6} />
                <Line type="monotone" dataKey="sharpe" name="Max Sharpe" stroke="#7d9b76" dot={false} strokeWidth={1.2} />
                <Line type="monotone" dataKey="erc" name="ERC" stroke="#c17c74" dot={false} strokeWidth={1.2} />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Look-through · {etfSymbol}</CardTitle>
          <CardDescription>
            FMP etf/info, etf/holdings, etf/sector-weightings, etf/country-weightings. Expense{" "}
            {etfInfo?.expenseRatio != null ? `${num(etfInfo.expenseRatio, 2)}%` : "—"} · AUM{" "}
            {etfInfo?.assetsUnderManagement != null ? money(etfInfo.assetsUnderManagement, true) : "—"} · holdings{" "}
            {etfInfo?.holdingsCount ?? "—"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holding</TableHead>
                <TableHead className="text-right">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {etfHoldings.map((row) => (
                <TableRow key={row.asset ?? row.name}>
                  <TableCell className="font-mono">{row.asset ?? row.name}</TableCell>
                  <TableCell className="text-right font-mono">{pct((row.weightPercentage ?? 0) / 100, false)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="space-y-2 text-sm">
            {etfSectors.map((row) => (
              <div key={row.sector} className="flex justify-between">
                <span>{row.sector}</span>
                <span className="font-mono">{pct(row.weightPercentage / 100, false)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            {etfCountries.length === 0 ? (
              <p className="text-muted-foreground">No country weights.</p>
            ) : (
              etfCountries.map((row) => (
                <div key={row.country} className="flex justify-between">
                  <span>{row.country}</span>
                  <span className="font-mono">{pct(parseWeightPct(row.weightPercentage), false)}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
