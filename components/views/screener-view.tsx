"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchFmp } from "@/lib/fmp/browser";
import type { FmpScreenerRow } from "@/lib/fmp/types";
import { money, num } from "@/lib/format";
import { usePortfolio } from "@/lib/portfolio/store";

const PRESETS: { name: string; params: Record<string, string | number | boolean> }[] = [
  {
    name: "Quality mega-caps",
    params: { marketCapMoreThan: 50_000_000_000, country: "US", isEtf: false, isActivelyTrading: true, sector: "Technology", limit: 25 },
  },
  {
    name: "Dividend sleeve",
    params: { dividendMoreThan: 1.5, country: "US", isEtf: false, isActivelyTrading: true, marketCapMoreThan: 2_000_000_000, limit: 25 },
  },
  {
    name: "US ETFs",
    params: { isEtf: true, country: "US", isActivelyTrading: true, limit: 25 },
  },
];

export function ScreenerView() {
  const { toggleWatch, state } = usePortfolio();
  const [sector, setSector] = useState("Technology");
  const [minCap, setMinCap] = useState("10000000000");
  const [minDiv, setMinDiv] = useState("");
  const [rows, setRows] = useState<FmpScreenerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(params: Record<string, string | number | boolean>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFmp<FmpScreenerRow[]>("company-screener", { limit: 40, isActivelyTrading: true, ...params });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screener failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Screener</p>
        <h1 className="font-heading text-4xl tracking-tight">Find the next lot</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>FMP company screener</CardTitle>
          <CardDescription>Filters hit `stable/company-screener`. Presets are a starting point, not advice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button key={preset.name} variant="outline" onClick={() => run(preset.params)}>
                {preset.name}
              </Button>
            ))}
          </div>
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const params: Record<string, string | number | boolean> = {
                country: "US",
                isEtf: false,
              };
              if (sector) params.sector = sector;
              if (minCap) params.marketCapMoreThan = Number(minCap);
              if (minDiv) params.dividendMoreThan = Number(minDiv);
              run(params);
            }}
          >
            <div>
              <Label htmlFor="sector">Sector</Label>
              <Input id="sector" value={sector} onChange={(e) => setSector(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cap">Min market cap</Label>
              <Input id="cap" value={minCap} onChange={(e) => setMinCap(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="div">Min dividend $</Label>
              <Input id="div" value={minDiv} onChange={(e) => setMinDiv(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Screening…" : "Run screen"}
              </Button>
            </div>
          </form>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Cap</TableHead>
                <TableHead className="text-right">Beta</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.symbol}>
                  <TableCell>
                    <Link href={`/research/${row.symbol}`} className="font-mono hover:underline">
                      {row.symbol}
                    </Link>
                    <div className="text-xs text-muted-foreground">{row.companyName}</div>
                  </TableCell>
                  <TableCell>
                    {row.sector}
                    <div className="text-xs text-muted-foreground">{row.industry}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{money(row.price)}</TableCell>
                  <TableCell className="text-right font-mono">{money(row.marketCap, true)}</TableCell>
                  <TableCell className="text-right font-mono">{num(row.beta, 2)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="xs" variant="ghost" onClick={() => toggleWatch(row.symbol)}>
                      {state.watchlist.includes(row.symbol) ? "Watching" : "Watch"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
