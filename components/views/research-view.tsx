"use client";

import { useEffect, useRef, useState } from "react";
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
import { fetchFmp, fetchFmpOptional } from "@/lib/fmp/browser";
import { ClientOnly } from "@/lib/hooks/use-mounted";
import { standardizedSurprises } from "@/lib/engine/attribution";
import { twoStageFcff, waccFromCapm } from "@/lib/engine/dcf";
import { carTStat, earningsCars } from "@/lib/engine/eventstudy";
import { dividendDiscount, residualIncome } from "@/lib/engine/residual-income";
import type {
  FmpBalanceSheet,
  FmpCashFlow,
  FmpDividend,
  FmpGrades,
  FmpGrowth,
  FmpOwnerEarnings,
  FmpDcf,
  FmpEarnings,
  FmpEstimate,
  FmpIncome,
  FmpLightBar,
  FmpMetricsTtm,
  FmpNews,
  FmpPeer,
  FmpPriceChange,
  FmpPriceTarget,
  FmpProfile,
  FmpQuote,
  FmpRating,
  FmpRatiosTtm,
  FmpRiskPremium,
  FmpScore,
  FmpSectorPe,
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
          Quotes, two-stage FCFF, residual income, Gordon DPS, owner earnings, grades, SUE, and market-adjusted
          earnings CARs from FMP stable endpoints.
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
  const [balance, setBalance] = useState<FmpBalanceSheet[]>([]);
  const [estimates, setEstimates] = useState<FmpEstimate[]>([]);
  const [earnings, setEarnings] = useState<FmpEarnings[]>([]);
  const [target, setTarget] = useState<FmpPriceTarget | null>(null);
  const [rating, setRating] = useState<FmpRating | null>(null);
  const [erpUs, setErpUs] = useState<number | null>(null);
  const [ownerEarn, setOwnerEarn] = useState<FmpOwnerEarnings[]>([]);
  const [grades, setGrades] = useState<FmpGrades | null>(null);
  const [growth, setGrowth] = useState<FmpGrowth[]>([]);
  const [dividends, setDividends] = useState<FmpDividend[]>([]);
  const [spyHistory, setSpyHistory] = useState<FmpLightBar[]>([]);
  const [sectorPe, setSectorPe] = useState<FmpSectorPe[]>([]);
  const erpSeeded = useRef(false);
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

        const [est, earn, tgt, rat, prem, bs, oe, gr, grow, divs, spy, pe] = await Promise.all([
          fetchFmpOptional<FmpEstimate[]>("analyst-estimates", { symbol, period: "annual", limit: 6 }),
          fetchFmpOptional<FmpEarnings[]>("earnings", { symbol, limit: 12 }),
          fetchFmpOptional<FmpPriceTarget[]>("price-target-consensus", { symbol }),
          fetchFmpOptional<FmpRating[]>("ratings-snapshot", { symbol }),
          fetchFmpOptional<FmpRiskPremium[]>("market-risk-premium"),
          fetchFmpOptional<FmpBalanceSheet[]>("balance-sheet-statement", { symbol, period: "annual", limit: 3 }),
          fetchFmpOptional<FmpOwnerEarnings[]>("owner-earnings", { symbol, limit: 6 }),
          fetchFmpOptional<FmpGrades[]>("grades-consensus", { symbol }),
          fetchFmpOptional<FmpGrowth[]>("financial-growth", { symbol, period: "annual", limit: 4 }),
          fetchFmpOptional<FmpDividend[]>("dividends", { symbol, limit: 8 }),
          fetchFmpOptional<FmpLightBar[]>("historical-price-eod/light", { symbol: "SPY" }),
          fetchFmpOptional<FmpSectorPe[]>("sector-pe-snapshot", { date: lastWeekday(), exchange: "NASDAQ" }),
        ]);
        if (cancelled) return;
        setEstimates(est ?? []);
        setEarnings(earn ?? []);
        setTarget(tgt?.[0] ?? null);
        setRating(rat?.[0] ?? null);
        setBalance(bs ?? []);
        setOwnerEarn(oe ?? []);
        setGrades(gr?.[0] ?? null);
        setGrowth(grow ?? []);
        setDividends(divs ?? []);
        setSpyHistory(spy ?? []);
        setSectorPe(pe ?? []);
        const us = (prem ?? []).find((row) => /united states/i.test(row.country));
        if (us?.totalEquityRiskPremium != null) setErpUs(us.totalEquityRiskPremium);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Research load failed");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (erpSeeded.current || erpUs == null) return;
    erpSeeded.current = true;
    setDcfInputs((prev) => ({ ...prev, erp: erpUs }));
  }, [erpUs]);

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
  const netDebt =
    balance[0]?.netDebt != null
      ? Number(balance[0].netDebt)
      : ev && mcap
        ? ev - mcap
        : 0;
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
  const sue = standardizedSurprises(
    earnings.map((row) => ({
      date: row.date,
      actual: row.epsActual ?? null,
      estimate: row.epsEstimated ?? null,
    })),
  );
  const lastSue = sue[0];
  const targetUpside =
    target?.targetConsensus && price ? target.targetConsensus / price - 1 : null;
  const ke = dcfInputs.rf / 100 + (profile?.beta ?? 1) * (dcfInputs.erp / 100);
  const bookValue =
    (balance[0]?.totalStockholdersEquity ?? 0) / Math.max(sharesOut || 1, 1e-9);
  const roe = Number(ratios?.returnOnEquityTTM) || 0;
  const bookG = Number(growth[0]?.bookValueperShareGrowth) || dcfInputs.gStable / 100;
  const ri = bookValue
    ? residualIncome({
        bookValue,
        roe,
        costEquity: ke,
        growth: Math.min(bookG, ke - 0.005),
        years: dcfInputs.years,
      })
    : null;
  const ttmDps = dividends.slice(0, 4).reduce((s, row) => s + (row.adjDividend ?? row.dividend ?? 0), 0);
  const ddm = ttmDps > 0 ? dividendDiscount(ttmDps, ke, dcfInputs.gStable / 100) : null;
  const cars = earningsCars(
    history,
    spyHistory,
    earnings.map((e) => e.date),
    1,
    1,
  );
  const printedCars = cars.filter((c) => earnings.find((e) => e.date === c.date)?.epsActual != null);
  const carStat = carTStat(printedCars);
  const namePe = Number(ratios?.priceToEarningsRatioTTM) || 0;
  const sectorRow = matchSectorPe(profile?.sector, sectorPe);
  const peVsSector = namePe && sectorRow?.pe ? namePe / sectorRow.pe - 1 : null;
  const latestGrowth = growth[0];
  const gradeTotal =
    (grades?.strongBuy ?? 0) +
    (grades?.buy ?? 0) +
    (grades?.hold ?? 0) +
    (grades?.sell ?? 0) +
    (grades?.strongSell ?? 0);

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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Consensus target"
          value={money(target?.targetConsensus)}
          hint={
            targetUpside == null
              ? `high ${money(target?.targetHigh)} · low ${money(target?.targetLow)}`
              : `${targetUpside >= 0 ? "Upside" : "Downside"} ${pct(Math.abs(targetUpside), false)}`
          }
        />
        <Stat
          label="FMP rating"
          value={rating?.rating ?? "—"}
          hint={`overall ${rating?.overallScore ?? "—"} · DCF ${rating?.discountedCashFlowScore ?? "—"}`}
        />
        <Stat
          label="US ERP"
          value={erpUs == null ? "—" : `${num(erpUs, 2)}%`}
          hint="market-risk-premium · seeds WACC"
        />
        <Stat
          label="Last SUE"
          value={lastSue ? num(lastSue.sue, 2) : "—"}
          hint={lastSue ? `surprise ${num(lastSue.surprise, 2)} · ${lastSue.date}` : "Need actual vs estimate"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Residual income"
          value={ri ? money(ri.equityValue) : "—"}
          hint={
            ri
              ? `B ${money(bookValue)} · ROE ${pct(roe, false)} · r ${pct(ke, false)}`
              : "Needs book / share and TTM EPS"
          }
        />
        <Stat
          label="RI vs last"
          value={ri && price ? money(ri.equityValue - price) : "—"}
          hint={ri ? `PV residual ${money(ri.pvResidual)} + TV ${money(ri.pvTerminal)}` : "Edwards–Bell–Ohlson"}
        />
        <Stat
          label="Gordon DPS"
          value={ddm != null ? money(ddm) : "—"}
          hint={ttmDps > 0 ? `TTM DPS ${money(ttmDps)} / (r − g)` : "Needs dividend history"}
        />
        <Stat
          label="Mean CAR"
          value={printedCars.length ? pct(carStat.mean, true) : "—"}
          hint={`Market-adj. [−1,+1] · t ${printedCars.length > 1 ? num(carStat.t, 2) : "—"} · n ${carStat.n}`}
        />
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
              <span className="text-muted-foreground">Net debt (balance sheet)</span>
              <span className="font-mono">{money(netDebt, true)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">WACC</span>
              <span className="font-mono">{pct(wacc, false)}</span>
            </div>
            {erpUs != null ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">FMP US equity risk premium</span>
                <span className="font-mono">{num(erpUs, 2)}%</span>
              </div>
            ) : null}
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">P/E vs sector</span>
              <span className="font-mono">
                {peVsSector == null
                  ? "—"
                  : `${num(namePe, 1)} / ${num(sectorRow?.pe, 1)} (${pct(peVsSector, true)})`}
              </span>
            </div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Analyst estimates</CardTitle>
            <CardDescription>FMP analyst-estimates, annual. Consensus revenue and EPS.</CardDescription>
          </CardHeader>
          <CardContent>
            {estimates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No estimates for this symbol.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Rev avg</TableHead>
                    <TableHead className="text-right">EPS avg</TableHead>
                    <TableHead className="text-right"># EPS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimates.slice(0, 6).map((row, i) => (
                    <TableRow key={`${row.date ?? "est"}-${i}`}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right font-mono">{money(row.revenueAvg, true)}</TableCell>
                      <TableCell className="text-right font-mono">{num(row.epsAvg, 2)}</TableCell>
                      <TableCell className="text-right font-mono">{row.numAnalystsEps ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Earnings &amp; SUE</CardTitle>
            <CardDescription>
              Standardized unexpected earnings: (actual − estimate) / σ of the surprise series. FMP earnings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No EPS actuals vs estimates yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Est.</TableHead>
                    <TableHead className="text-right">SUE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sue.slice(0, 8).map((row) => {
                    const raw = earnings.find((e) => e.date === row.date);
                    return (
                      <TableRow key={row.date}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell className="text-right font-mono">{num(raw?.epsActual, 2)}</TableCell>
                        <TableCell className="text-right font-mono">{num(raw?.epsEstimated, 2)}</TableCell>
                        <TableCell className="text-right font-mono">{num(row.sue, 2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Residual income</CardTitle>
            <CardDescription>
              V₀ = B₀ + Σ (ROE − r) Bₜ₋₁ / (1+r)ᵗ + TV. Book grows at min(book g, r − 50bp). Clean surplus if payout =
              1 − g/ROE.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Book / share</span>
              <span className="font-mono">{money(bookValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ROE TTM · cost of equity</span>
              <span className="font-mono">
                {pct(roe, false)} · {pct(ke, false)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Growth used</span>
              <span className="font-mono">{pct(Math.min(bookG, ke - 0.005), false)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PV residual + PV terminal</span>
              <span className="font-mono">
                {money(ri?.pvResidual)} + {money(ri?.pvTerminal)}
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Equity value / last</span>
              <span className="font-mono">
                {money(ri?.equityValue)} / {money(price)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gordon DPS</span>
              <span className="font-mono">{ddm != null ? money(ddm) : "—"}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Owner earnings</CardTitle>
            <CardDescription>FMP owner-earnings. Buffett: NI + D&amp;A − maintenance capex.</CardDescription>
          </CardHeader>
          <CardContent>
            {ownerEarn.length === 0 ? (
              <p className="text-sm text-muted-foreground">No owner-earnings rows for this symbol.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FY</TableHead>
                    <TableHead className="text-right">OE</TableHead>
                    <TableHead className="text-right">OE / sh</TableHead>
                    <TableHead className="text-right">Maint. capex</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ownerEarn.slice(0, 5).map((row, i) => (
                    <TableRow key={`${row.date ?? row.fiscalYear}-${i}`}>
                      <TableCell>{row.fiscalYear ?? row.date}</TableCell>
                      <TableCell className="text-right font-mono">{money(row.ownersEarnings, true)}</TableCell>
                      <TableCell className="text-right font-mono">{num(row.ownersEarningsPerShare, 2)}</TableCell>
                      <TableCell className="text-right font-mono">{money(row.maintenanceCapex, true)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Grades consensus</CardTitle>
            <CardDescription>
              FMP grades-consensus{grades?.consensus ? ` · ${grades.consensus}` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!grades ? (
              <p className="text-sm text-muted-foreground">No grade counts for this symbol.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    [
                      ["Strong buy", grades.strongBuy],
                      ["Buy", grades.buy],
                      ["Hold", grades.hold],
                      ["Sell", grades.sell],
                      ["Strong sell", grades.strongSell],
                    ] as const
                  ).map(([label, count]) => (
                    <TableRow key={label}>
                      <TableCell>{label}</TableCell>
                      <TableCell className="text-right font-mono">{count ?? 0}</TableCell>
                      <TableCell className="text-right font-mono">
                        {gradeTotal ? pct((count ?? 0) / gradeTotal, false) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Financial growth</CardTitle>
            <CardDescription>FMP financial-growth, annual. Latest {latestGrowth?.date ?? "—"}.</CardDescription>
          </CardHeader>
          <CardContent>
            {!latestGrowth ? (
              <p className="text-sm text-muted-foreground">No growth rows for this symbol.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <GrowthCell label="Revenue" value={latestGrowth.revenueGrowth} />
                <GrowthCell label="Net income" value={latestGrowth.netIncomeGrowth} />
                <GrowthCell label="EPS" value={latestGrowth.epsgrowth} />
                <GrowthCell label="FCF" value={latestGrowth.freeCashFlowGrowth} />
                <GrowthCell label="Book / share" value={latestGrowth.bookValueperShareGrowth} />
                <GrowthCell label="DPS" value={latestGrowth.dividendsPerShareGrowth} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Earnings CAR</CardTitle>
          <CardDescription>
            Market-adjusted ARₜ = rᵢ − r_SPY on [−1, +1] around each print with an actual EPS. Mean CAR{" "}
            {printedCars.length ? pct(carStat.mean, true) : "—"} · t {printedCars.length > 1 ? num(carStat.t, 2) : "—"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {printedCars.length === 0 ? (
            <p className="text-sm text-muted-foreground">Need overlapping price history and EPS actuals.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">AR₀</TableHead>
                  <TableHead className="text-right">CAR</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printedCars.slice(0, 8).map((row) => (
                  <TableRow key={row.date}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell className="text-right font-mono">{pct(row.ar0, true)}</TableCell>
                    <TableCell className="text-right font-mono">{pct(row.car, true)}</TableCell>
                    <TableCell className="text-right font-mono">{row.n}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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

function lastWeekday() {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function matchSectorPe(sector: string | undefined, rows: FmpSectorPe[]) {
  if (!sector) return null;
  const key = sector.toLowerCase();
  return (
    rows.find((row) => row.sector.toLowerCase() === key) ??
    rows.find((row) => row.sector.toLowerCase().includes(key) || key.includes(row.sector.toLowerCase())) ??
    null
  );
}

function GrowthCell({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="text-[11px] text-muted-foreground uppercase">{label}</div>
      <div className="font-mono">{pct(value, true)}</div>
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
