"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DeltaFromPercent } from "@/components/delta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchFmp, fetchFmpOptional } from "@/lib/fmp/browser";
import { ClientOnly } from "@/lib/hooks/use-mounted";
import { earningsYieldGap } from "@/lib/engine/bonds";
import { curvePoints, fitNelsonSiegel, treasuryToCurve } from "@/lib/engine/nelson-siegel";
import type {
  FmpDividend,
  FmpEconEvent,
  FmpEconPoint,
  FmpHours,
  FmpIndustryPe,
  FmpIndustryPerf,
  FmpMover,
  FmpQuote,
  FmpRatiosTtm,
  FmpSector,
  FmpSectorPe,
  FmpTreasury,
} from "@/lib/fmp/types";
import { money, num, pct } from "@/lib/format";
import { useQuotes } from "@/lib/hooks/use-quotes";
import { usePortfolio } from "@/lib/portfolio/store";

const INDEXES = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX"];

function lastWeekday() {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function isoShift(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function MarketsView() {
  const { quotes } = useQuotes(INDEXES);
  const { state } = usePortfolio();
  const bookSymbols = new Set(state.holdings.map((h) => h.symbol));
  const [sectors, setSectors] = useState<FmpSector[]>([]);
  const [gainers, setGainers] = useState<FmpMover[]>([]);
  const [losers, setLosers] = useState<FmpMover[]>([]);
  const [actives, setActives] = useState<FmpMover[]>([]);
  const [treasury, setTreasury] = useState<FmpTreasury | null>(null);
  const [hours, setHours] = useState<FmpHours | null>(null);
  const [cpi, setCpi] = useState<FmpEconPoint | null>(null);
  const [unemp, setUnemp] = useState<FmpEconPoint | null>(null);
  const [fed, setFed] = useState<FmpEconPoint | null>(null);
  const [econ, setEcon] = useState<FmpEconEvent[]>([]);
  const [sectorPe, setSectorPe] = useState<FmpSectorPe[]>([]);
  const [industryPe, setIndustryPe] = useState<FmpIndustryPe[]>([]);
  const [industryPerf, setIndustryPerf] = useState<FmpIndustryPerf[]>([]);
  const [divCal, setDivCal] = useState<FmpDividend[]>([]);
  const [spyPe, setSpyPe] = useState<number | null>(null);

  useEffect(() => {
    const date = lastWeekday();
    Promise.all([
      fetchFmp<FmpSector[]>("sector-performance-snapshot", { date }),
      fetchFmp<FmpMover[]>("biggest-gainers"),
      fetchFmp<FmpMover[]>("biggest-losers"),
      fetchFmp<FmpMover[]>("most-actives"),
      fetchFmp<FmpTreasury[]>("treasury-rates"),
      fetchFmp<FmpHours[]>("exchange-market-hours", { exchange: "NASDAQ" }),
    ]).then(([s, g, l, a, t, h]) => {
      setSectors(s.data ?? []);
      setGainers((g.data ?? []).slice(0, 6));
      setLosers((l.data ?? []).slice(0, 6));
      setActives((a.data ?? []).slice(0, 6));
      setTreasury(t.data?.[0] ?? null);
      setHours(h.data?.[0] ?? null);
    });
    Promise.all([
      fetchFmpOptional<FmpEconPoint[]>("economic-indicators", { name: "CPI" }),
      fetchFmpOptional<FmpEconPoint[]>("economic-indicators", { name: "unemploymentRate" }),
      fetchFmpOptional<FmpEconPoint[]>("economic-indicators", { name: "federalFunds" }),
      fetchFmpOptional<FmpEconEvent[]>("economic-calendar", {
        country: "US",
        from: isoShift(-10),
        to: isoShift(21),
      }),
      fetchFmpOptional<FmpSectorPe[]>("sector-pe-snapshot", { date, exchange: "NASDAQ" }),
      fetchFmpOptional<FmpIndustryPe[]>("industry-pe-snapshot", { date, exchange: "NASDAQ" }),
      fetchFmpOptional<FmpIndustryPerf[]>("industry-performance-snapshot", { date, exchange: "NASDAQ" }),
      fetchFmpOptional<FmpDividend[]>("dividends-calendar", { from: isoShift(-3), to: isoShift(45) }),
      fetchFmpOptional<FmpRatiosTtm[]>("ratios-ttm", { symbol: "SPY" }),
    ]).then(([c, u, f, cal, pe, ind, perf, divs, spyRatios]) => {
      setCpi(c?.[0] ?? null);
      setUnemp(u?.[0] ?? null);
      setFed(f?.[0] ?? null);
      setSectorPe(pe ?? []);
      setIndustryPe((ind ?? []).slice(0, 12));
      setIndustryPerf((perf ?? []).slice(0, 12));
      setDivCal(divs ?? []);
      const peTtm = Number(spyRatios?.[0]?.priceToEarningsRatioTTM);
      setSpyPe(Number.isFinite(peTtm) && peTtm > 0 ? peTtm : null);
      setEcon(
        (cal ?? [])
          .slice()
          .sort((a, b) => {
            const rank = (x: string | undefined) =>
              /high/i.test(x ?? "") ? 0 : /medium/i.test(x ?? "") ? 1 : 2;
            return rank(a.impact) - rank(b.impact) || a.date.localeCompare(b.date);
          })
          .slice(0, 12),
      );
    });
  }, []);

  const curve = useMemo(() => (treasury ? treasuryToCurve(treasury) : []), [treasury]);
  const ns = useMemo(
    () => (curve.length >= 4 ? fitNelsonSiegel(curve.map((c) => c.tau), curve.map((c) => c.yield)) : null),
    [curve],
  );
  const fedGap = useMemo(() => {
    const y10 = treasury?.year10;
    if (spyPe == null || y10 == null) return null;
    return earningsYieldGap(spyPe, y10);
  }, [spyPe, treasury?.year10]);

  const nsChart = useMemo(() => {
    if (!ns || !curve.length) return curve.map((c) => ({ tenor: c.tenor, observed: c.yield, fitted: c.yield }));
    const dense = curvePoints(ns, curve.map((c) => c.tau));
    return curve.map((c, i) => ({ tenor: c.tenor, observed: c.yield, fitted: dense[i]?.yield ?? c.yield }));
  }, [curve, ns]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">The tape</p>
          <h1 className="font-heading text-4xl tracking-tight">Markets, industry tape, and the curve</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          {hours ? (
            <div>
              NASDAQ {hours.isMarketOpen ? "open" : "closed"} · {hours.openingHour}–{hours.closingHour} {hours.timezone}
            </div>
          ) : null}
          <div>
            Fed gap {fedGap == null ? "—" : pct(fedGap, true)}
            {spyPe != null && treasury?.year10 != null
              ? ` · SPY E/P ${pct(1 / spyPe, false)} vs 10y ${num(treasury.year10, 2)}%`
              : ""}
          </div>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {INDEXES.map((sym) => (
          <IndexCard key={sym} quote={quotes[sym]} fallback={sym} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Sector snapshot</CardTitle>
            <CardDescription>FMP sector-performance-snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sectors.map((row) => (
              <div key={row.sector} className="flex items-center justify-between text-sm">
                <span>{row.sector}</span>
                <DeltaFromPercent value={row.averageChange} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sector P/E</CardTitle>
            <CardDescription>FMP sector-pe-snapshot · NASDAQ · {lastWeekday()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sectorPe.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sector P/E rows for this date.</p>
            ) : (
              sectorPe.map((row) => (
                <div key={`${row.sector}-${row.exchange ?? ""}`} className="flex items-center justify-between text-sm">
                  <span>{row.sector}</span>
                  <span className="font-mono tabular-nums">{num(row.pe, 1)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Treasury + Nelson–Siegel</CardTitle>
            <CardDescription>
              {treasury?.date}
              {ns ? ` · β0 ${num(ns.beta0, 2)} λ ${num(ns.lambda, 2)} RMSE ${num(ns.rmse, 3)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
            <ResponsiveContainer initialDimension={{ width: 480, height: 220 }}>
              <LineChart data={nsChart}>
                <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip />
                <Line type="monotone" dataKey="observed" name="FMP" stroke="#d4b483" strokeWidth={1.6} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="fitted" name="NS" stroke="#8a9ba8" strokeWidth={1.4} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            </ClientOnly>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Industry P/E</CardTitle>
            <CardDescription>FMP industry-pe-snapshot · NASDAQ · {lastWeekday()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {industryPe.length === 0 ? (
              <p className="text-sm text-muted-foreground">No industry P/E rows for this date.</p>
            ) : (
              industryPe.map((row) => (
                <div key={`${row.industry}-${row.exchange ?? ""}`} className="flex items-center justify-between text-sm">
                  <span>{row.industry}</span>
                  <span className="font-mono tabular-nums">{num(row.pe, 1)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Industry tape</CardTitle>
            <CardDescription>FMP industry-performance-snapshot · NASDAQ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {industryPerf.length === 0 ? (
              <p className="text-sm text-muted-foreground">No industry performance rows for this date.</p>
            ) : (
              industryPerf.map((row) => (
                <div key={`${row.industry}-${row.exchange ?? ""}`} className="flex items-center justify-between text-sm">
                  <span>{row.industry}</span>
                  <DeltaFromPercent value={row.averageChange} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Book dividend calendar</CardTitle>
            <CardDescription>FMP dividends-calendar filtered to names in the book</CardDescription>
          </CardHeader>
          <CardContent>
            {divCal.filter((row) => bookSymbols.has(row.symbol)).length === 0 ? (
              <p className="text-sm text-muted-foreground">No book names in the next 45 days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Ex</TableHead>
                    <TableHead className="text-right">DPS</TableHead>
                    <TableHead className="text-right">Yield</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {divCal
                    .filter((row) => bookSymbols.has(row.symbol))
                    .slice(0, 8)
                    .map((row, i) => (
                      <TableRow key={`${row.symbol}-${row.date}-${i}`}>
                        <TableCell className="font-mono">
                          <Link href={`/research/${row.symbol}`} className="hover:text-primary">
                            {row.symbol}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.date}</TableCell>
                        <TableCell className="text-right font-mono">{num(row.adjDividend ?? row.dividend, 2)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {row.yield != null ? `${num(row.yield, 2)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>US macro</CardTitle>
            <CardDescription>FMP economic-indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MacroRow label="CPI" point={cpi} digits={1} />
            <MacroRow label="Unemployment" point={unemp} digits={2} suffix="%" />
            <MacroRow label="Fed funds" point={fed} digits={2} suffix="%" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Economic calendar</CardTitle>
            <CardDescription>US releases · economic-calendar</CardDescription>
          </CardHeader>
          <CardContent>
            {econ.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calendar rows in this window.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="text-right">Est.</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {econ.map((row, i) => (
                    <TableRow key={`${row.date}-${row.event}-${i}`}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{row.date.slice(0, 10)}</TableCell>
                      <TableCell>
                        <div>{row.event}</div>
                        <div className="text-xs text-muted-foreground">{row.impact}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{row.estimate ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{row.actual ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <MoverCard title="Gainers" rows={gainers} />
        <MoverCard title="Losers" rows={losers} />
        <MoverCard title="Most active" rows={actives} />
      </div>
    </div>
  );
}

function IndexCard({ quote, fallback }: { quote?: FmpQuote; fallback: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="truncate">{quote?.name ?? fallback}</CardDescription>
        <CardTitle className="font-mono text-xl tabular-nums">{quote ? num(quote.price, 2) : "—"}</CardTitle>
        <DeltaFromPercent value={quote?.changePercentage} />
      </CardHeader>
    </Card>
  );
}

function MoverCard({ title, rows }: { title: string; rows: FmpMover[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <Link key={row.symbol} href={`/research/${row.symbol}`} className="flex items-center justify-between text-sm hover:text-primary">
            <span className="font-mono">{row.symbol}</span>
            <span className="flex items-center gap-3">
              <span className="font-mono tabular-nums">{money(row.price)}</span>
              <DeltaFromPercent value={row.changesPercentage} />
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function MacroRow({
  label,
  point,
  digits,
  suffix = "",
}: {
  label: string;
  point: FmpEconPoint | null;
  digits: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div>{label}</div>
        <div className="text-xs text-muted-foreground">{point?.date ?? "—"}</div>
      </div>
      <div className="font-mono tabular-nums">
        {point ? `${num(point.value, digits)}${suffix}` : "—"}
      </div>
    </div>
  );
}
