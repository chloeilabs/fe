"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DeltaFromPercent } from "@/components/delta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchFmp } from "@/lib/fmp/browser";
import { ClientOnly } from "@/lib/hooks/use-mounted";
import type { FmpHours, FmpMover, FmpQuote, FmpSector, FmpTreasury } from "@/lib/fmp/types";
import { money, num } from "@/lib/format";
import { useQuotes } from "@/lib/hooks/use-quotes";

const INDEXES = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX"];

function lastWeekday() {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function MarketsView() {
  const { quotes } = useQuotes(INDEXES);
  const [sectors, setSectors] = useState<FmpSector[]>([]);
  const [gainers, setGainers] = useState<FmpMover[]>([]);
  const [losers, setLosers] = useState<FmpMover[]>([]);
  const [actives, setActives] = useState<FmpMover[]>([]);
  const [treasury, setTreasury] = useState<FmpTreasury | null>(null);
  const [hours, setHours] = useState<FmpHours | null>(null);

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
  }, []);

  const curve = treasury
    ? [
        { tenor: "3M", yield: treasury.month3 },
        { tenor: "6M", yield: treasury.month6 },
        { tenor: "1Y", yield: treasury.year1 },
        { tenor: "2Y", yield: treasury.year2 },
        { tenor: "5Y", yield: treasury.year5 },
        { tenor: "10Y", yield: treasury.year10 },
        { tenor: "30Y", yield: treasury.year30 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">The tape</p>
          <h1 className="font-heading text-4xl tracking-tight">Markets and the risk-free curve</h1>
        </div>
        {hours ? (
          <div className="text-sm text-muted-foreground">
            NASDAQ {hours.isMarketOpen ? "open" : "closed"} · {hours.openingHour}–{hours.closingHour} {hours.timezone}
          </div>
        ) : null}
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {INDEXES.map((sym) => (
          <IndexCard key={sym} quote={quotes[sym]} fallback={sym} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
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
            <CardTitle>Treasury curve</CardTitle>
            <CardDescription>{treasury?.date}</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
            <ResponsiveContainer initialDimension={{ width: 480, height: 220 }}>
              <BarChart data={curve}>
                <XAxis dataKey="tenor" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="yield" fill="#d4b483" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </ClientOnly>
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
