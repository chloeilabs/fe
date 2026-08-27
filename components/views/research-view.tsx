"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Star } from "lucide-react";

import { DeltaFromPercent } from "@/components/delta";
import { SymbolSearch } from "@/components/symbol-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchFmp } from "@/lib/fmp/browser";
import { ClientOnly } from "@/lib/hooks/use-mounted";
import { twoStageFcff, waccFromCapm } from "@/lib/engine/dcf";
import type {
  FmpCashFlow,
  FmpDcf,
  FmpIncome,
  FmpLightBar,
  FmpMetricsTtm,
  FmpNews,
  FmpPeer,
  FmpPriceChange,
  FmpProfile,
  FmpQuote,
  FmpRatiosTtm,
  FmpScore,
} from "@/lib/fmp/types";
import { money, num, pct } from "@/lib/format";
import { usePortfolio } from "@/lib/portfolio/store";

export function ResearchHome() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Research</p>
        <h1 className="font-heading text-4xl tracking-tight">Look through the security</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Quotes, two-stage FCFF, TTM ratios, scores, and filings-grade financials from FMP stable endpoints.
        </p>
      </header>
      <SymbolSearch autoFocus />
    </div>
  );
}

export function ResearchView({ symbol }: { symbol: string }) {
  const { state, toggleWatch } = usePortfolio();
  const watched = state.watchlist.includes(symbol);
  const [quote, setQuote] = useState<FmpQuote | null>(null);
  const [profile, setProfile] = useState<FmpProfile | null>(null);
  const [history, setHistory] = useState<FmpLightBar[]>([]);
  const [dcf, setDcf] = useState<FmpDcf | null>(null);
  const [ratios, setRatios] = useState<FmpRatiosTtm | null>(null);
  const [metrics, setMetrics] = useState<FmpMetricsTtm | null>(null);
  const [scores, setScores] = useState<FmpScore | null>(null);
  const [income, setIncome] = useState<FmpIncome[]>([]);
  const [cashFlow, setCashFlow] = useState<FmpCashFlow[]>([]);
  const [news, setNews] = useState<FmpNews[]>([]);
  const [peers, setPeers] = useState<FmpPeer[]>([]);
  const [change, setChange] = useState<FmpPriceChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dcfInputs, setDcfInputs] = useState({
    gHigh: 8,
    gStable: 2.5,
    years: 5,
    erp: 5,
    rf: 4.3,
    kd: 5,
    tax: 21,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [q, p, h, d, r, m, s, inc, cf, n, pr, ch] = await Promise.all([
          fetchFmp<FmpQuote[]>("quote", { symbol }),
          fetchFmp<FmpProfile[]>("profile", { symbol }),
          fetchFmp<FmpLightBar[]>("historical-price-eod/light", { symbol }),
          fetchFmp<FmpDcf[]>("discounted-cash-flow", { symbol }),
          fetchFmp<FmpRatiosTtm[]>("ratios-ttm", { symbol }),
          fetchFmp<FmpMetricsTtm[]>("key-metrics-ttm", { symbol }),
          fetchFmp<FmpScore[]>("financial-scores", { symbol }),
          fetchFmp<FmpIncome[]>("income-statement", { symbol, period: "annual", limit: 5 }),
          fetchFmp<FmpCashFlow[]>("cash-flow-statement", { symbol, period: "annual", limit: 5 }),
          fetchFmp<FmpNews[]>("news/stock", { symbols: symbol, limit: 8 }),
          fetchFmp<FmpPeer[]>("stock-peers", { symbol }),
          fetchFmp<FmpPriceChange[]>("stock-price-change", { symbol }),
        ]);
        if (cancelled) return;
        setQuote(q.data?.[0] ?? null);
        setProfile(p.data?.[0] ?? null);
        setHistory([...(h.data ?? [])].reverse());
        setDcf(d.data?.[0] ?? null);
        setRatios(r.data?.[0] ?? null);
        setMetrics(m.data?.[0] ?? null);
        setScores(s.data?.[0] ?? null);
        setIncome(inc.data ?? []);
        setCashFlow(cf.data ?? []);
        setNews(n.data ?? []);
        setPeers(Array.isArray(pr.data) ? pr.data : []);
        setChange(ch.data?.[0] ?? null);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Research load failed");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const price = quote?.price ?? profile?.price ?? 0;
  const intrinsic = dcf?.dcf ?? 0;
  const mos = intrinsic && price ? intrinsic / price - 1 : null;
  const chart = history.slice(-180).map((b) => ({ date: b.date.slice(5), price: b.price }));
  const fcff =
    Number(metrics?.freeCashFlowToFirmTTM) ||
    cashFlow[0]?.freeCashFlow ||
    0;
  const sharesOut =
    income[0]?.weightedAverageShsOut ||
    (metrics?.marketCap && price ? Number(metrics.marketCap) / price : 0);
  const ev = Number(metrics?.enterpriseValueTTM) || 0;
  const mcap = Number(metrics?.marketCap) || 0;
  const netDebt = ev && mcap ? ev - mcap : 0;
  const equityWeight = ev > 0 ? mcap / ev : 1;
  const wacc = waccFromCapm({
    rf: dcfInputs.rf / 100,
    beta: profile?.beta ?? 1,
    erp: dcfInputs.erp / 100,
    costDebt: dcfInputs.kd / 100,
    taxRate: dcfInputs.tax / 100,
    equityWeight,
  });
  const modelDcf = fcff
    ? twoStageFcff({
        fcff,
        shares: sharesOut || 1,
        netDebt,
        growthHigh: dcfInputs.gHigh / 100,
        growthStable: dcfInputs.gStable / 100,
        yearsHigh: dcfInputs.years,
        wacc,
      })
    : null;
  const modelMos = modelDcf && price ? modelDcf.perShare / price - 1 : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">{profile?.exchange ?? quote?.exchange}</p>
          <h1 className="font-heading text-4xl tracking-tight">
            <span className="font-mono">{symbol}</span>{" "}
            <span className="text-muted-foreground">{profile?.companyName ?? quote?.name}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="font-mono text-3xl tabular-nums">{money(price)}</div>
            <DeltaFromPercent value={quote?.changePercentage} />
            {profile?.sector ? <Badge variant="outline">{profile.sector}</Badge> : null}
            {profile?.isEtf ? <Badge variant="secondary">ETF</Badge> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={watched ? "secondary" : "outline"} onClick={() => toggleWatch(symbol)}>
            <Star className={watched ? "fill-current" : ""} />
            {watched ? "Watching" : "Watch"}
          </Button>
        </div>
      </header>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="max-w-xl">
        <SymbolSearch />
      </div>

      <Card className="h-72">
        <CardContent className="h-full pt-4">
          <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
          <ResponsiveContainer initialDimension={{ width: 800, height: 260 }}>
            <LineChart data={chart}>
              <XAxis dataKey="date" hide />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Line type="monotone" dataKey="price" stroke="#d4b483" dot={false} strokeWidth={1.6} />
            </LineChart>
          </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="FMP DCF" value={money(intrinsic)} hint={mos == null ? "—" : `${mos >= 0 ? "Discount" : "Premium"} ${pct(Math.abs(mos), false)}`} />
        <Stat
          label="Two-stage FCFF"
          value={money(modelDcf?.perShare)}
          hint={modelMos == null ? "—" : `${modelMos >= 0 ? "Discount" : "Premium"} ${pct(Math.abs(modelMos), false)} vs last`}
        />
        <Stat label="P/E TTM" value={num(Number(ratios?.priceToEarningsRatioTTM), 1)} hint={`FCF yield ${pct(Number(metrics?.freeCashFlowYieldTTM) || 0, false)}`} />
        <Stat label="Scores" value={`Z ${num(scores?.altmanZScore, 1)}`} hint={`Piotroski ${scores?.piotroskiScore ?? "—"}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Two-stage FCFF</CardTitle>
          <CardDescription>
            Explicit growth for {dcfInputs.years} years, then Gordon on FCFF<sub>n+1</sub>. WACC blends CAPM cost of
            equity with after-tax debt. Compare to FMP&apos;s published DCF.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["gHigh", "High growth %"],
                ["gStable", "Stable growth %"],
                ["years", "Stage-1 years"],
                ["erp", "ERP %"],
                ["rf", "r_f %"],
                ["kd", "Cost of debt %"],
                ["tax", "Tax %"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={`dcf-${key}`}>{label}</Label>
                <Input
                  id={`dcf-${key}`}
                  type="number"
                  step="any"
                  value={dcfInputs[key]}
                  onChange={(e) =>
                    setDcfInputs((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">FCFF</span>
              <span className="font-mono">{money(fcff, true)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net debt (EV − mkt cap)</span>
              <span className="font-mono">{money(netDebt, true)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">WACC</span>
              <span className="font-mono">{pct(wacc, false)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PV explicit + PV terminal</span>
              <span className="font-mono">
                {money(modelDcf?.pvExplicit, true)} + {money(modelDcf?.pvTerminal, true)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Enterprise / equity</span>
              <span className="font-mono">
                {money(modelDcf?.enterpriseValue, true)} / {money(modelDcf?.equityValue, true)}
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Value / share</span>
              <span className="font-mono">{money(modelDcf?.perShare)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">FMP DCF / last price</span>
              <span className="font-mono">
                {money(intrinsic)} / {money(price)}
              </span>
            </div>
            {profile?.isEtf ? (
              <p className="text-xs text-muted-foreground">
                ETF cash-flow DCF is a diagnostic, not an operating-company model.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>{profile?.industry} · {profile?.country} · beta {num(profile?.beta, 2)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>{profile?.description}</p>
            {profile?.website ? (
              <a className="text-foreground underline" href={profile.website} target="_blank" rel="noreferrer">
                {profile.website}
              </a>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Horizon returns</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-sm">
            {(["1D", "1M", "3M", "6M", "ytd", "1Y", "5Y", "10Y"] as const).map((k) => (
              <div key={k} className="rounded-lg bg-muted/40 p-2">
                <div className="text-[11px] text-muted-foreground uppercase">{k}</div>
                <DeltaFromPercent value={change?.[k]} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income statement</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FY</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Op. income</TableHead>
                <TableHead className="text-right">Net income</TableHead>
                <TableHead className="text-right">EPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {income.map((row) => (
                <TableRow key={`${row.fiscalYear}-${row.date}`}>
                  <TableCell>{row.fiscalYear ?? row.date}</TableCell>
                  <TableCell className="text-right font-mono">{money(row.revenue, true)}</TableCell>
                  <TableCell className="text-right font-mono">{money(row.operatingIncome, true)}</TableCell>
                  <TableCell className="text-right font-mono">{money(row.netIncome, true)}</TableCell>
                  <TableCell className="text-right font-mono">{num(row.eps, 2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Peers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {peers.map((peer) => {
              const sym = peer.symbol;
              return (
                <Link key={sym} href={`/research/${sym}`} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="font-mono">{sym}</span>
                  <span className="text-sm text-muted-foreground">{peer.companyName}</span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>News</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {news.map((item, index) => (
              <a key={`${item.url ?? item.title}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="block hover:text-primary">
                <div className="text-sm">{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  {item.publisher} · {item.publishedDate}
                </div>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="text-[11px] tracking-[0.14em] uppercase">{label}</CardDescription>
        <CardTitle className="font-mono text-xl">{value}</CardTitle>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </CardHeader>
    </Card>
  );
}
