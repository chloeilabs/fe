"use client";

import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Kpi } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { annualizeAlpha } from "@/lib/engine/capm";
import { annualizeAlphaDaily, famaFrench3, makeHml, makeSmb } from "@/lib/engine/factors";
import { alignedReturns, calmarRatio, effectiveN, maxDrawdown, sortinoRatio } from "@/lib/engine/risk";
import { dollarVaR } from "@/lib/engine/var";
import { fetchFmp } from "@/lib/fmp/browser";
import type { FmpLightBar } from "@/lib/fmp/types";
import { money, num, pct } from "@/lib/format";
import { useBookModel } from "@/lib/hooks/use-book-model";
import { ClientOnly } from "@/lib/hooks/use-mounted";

const FF_PROXY = ["IWM", "IWD", "IWF"] as const;

export function RiskView() {
  const book = useBookModel();
  const [ffBars, setFfBars] = useState<Record<string, FmpLightBar[]>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(FF_PROXY.map((symbol) => fetchFmp<FmpLightBar[]>("historical-price-eod/light", { symbol })))
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, FmpLightBar[]> = {};
        FF_PROXY.forEach((symbol, i) => {
          next[symbol] = rows[i]?.data ?? [];
        });
        setFfBars(next);
      })
      .catch(() => {
        if (!cancelled) setFfBars({});
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const wealthBars = book.port.reduce<{ date: string; price: number }[]>((acc, r, i) => {
    const prev = acc[acc.length - 1]?.price ?? 100;
    acc.push({ date: String(i), price: prev * (1 + r) });
    return acc;
  }, []);
  const dd = maxDrawdown(wealthBars);
  const nEff = effectiveN(book.weights);
  const rf = 0.043;
  const kalmanChart = (() => {
    const path = book.kalmanBetas;
    if (path.length < 2) return [];
    const step = Math.max(1, Math.floor(path.length / 140));
    return path
      .map((beta, i) => ({ t: i, beta }))
      .filter((_, i, arr) => i % step === 0 || i === arr.length - 1);
  })();
  const lastKalman = book.kalmanBetas[book.kalmanBetas.length - 1];
  const ff = useMemo(() => {
    const series = { ...book.series, ...ffBars };
    const { returns } = alignedReturns(series);
    const spy = returns.SPY ?? book.market;
    const iwm = returns.IWM ?? [];
    const iwd = returns.IWD ?? [];
    const iwf = returns.IWF ?? [];
    if (spy.length < 30 || iwm.length < 30 || iwd.length < 30 || iwf.length < 30) return null;
    const smb = makeSmb(iwm, spy);
    const hml = makeHml(iwd, iwf);
    const rfD = 0.043 / 252;
    const bookFf = famaFrench3(book.port, spy, smb, hml, rfD);
    const names = book.names.map((symbol) => ({
      symbol,
      ...famaFrench3(returns[symbol] ?? [], spy, smb, hml, rfD),
    }));
    return { bookFf, names };
  }, [book.market, book.names, book.port, book.series, ffBars]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Risk</p>
        <h1 className="font-heading text-4xl tracking-tight">VaR, factors, and CAPM</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Historical, Gaussian, and Cornish–Fisher VaR on the value-weighted book; EWMA (λ=0.94) vol; Jacobi PCA on
          the shrunk correlation matrix; OLS α/β versus SPY; scalar Kalman β; Fama–French 3-factor via IWM / IWD / IWF.
        </p>
      </header>
      {book.error ? <p className="text-sm text-destructive">{book.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ann. return" value={pct(book.annReturn, true)} hint={`Sortino ${num(sortinoRatio(book.port, rf), 2)}`} />
        <Kpi label="Ann. vol" value={pct(book.annVol, false)} hint={`EWMA vol ${pct(book.ewmaVol, false)}`} />
        <Kpi label="Sharpe" value={num(book.sharpe, 2)} hint={`Calmar ${num(calmarRatio(book.port, wealthBars), 2)}`} />
        <Kpi
          label="Max drawdown"
          value={pct(dd.maxDrawdown, true)}
          hint={`β ${num(book.bookCapm.beta, 2)} · R² ${num(book.bookCapm.r2, 2)}`}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="95% hist. VaR"
          value={pct(book.hist.var, false)}
          hint={`${money(dollarVaR(book.hist.var, book.invested))} on ${money(book.invested, true)}`}
        />
        <Kpi label="95% CVaR" value={pct(book.hist.cvar, false)} hint={`99% VaR ${pct(book.hist99.var, false)}`} />
        <Kpi
          label="Parametric 95%"
          value={pct(book.param.var, false)}
          hint={`Cornish–Fisher ${pct(book.cf.var, false)}`}
        />
        <Kpi
          label="Skew / ex-kurt"
          value={`${num(book.hist.skew, 2)} / ${num(book.hist.exkurt, 2)}`}
          hint={`Tracking error ${pct(book.te, false)}`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>CAPM by name</CardTitle>
          <CardDescription>
            OLS on aligned daily excess vs SPY. Book α {pct(annualizeAlpha(book.bookCapm.alpha), true)} annualized · IR{" "}
            {num(book.bookCapm.informationRatio * Math.sqrt(252), 2)}. Effective N {num(nEff, 2)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">β</TableHead>
                <TableHead className="text-right">α (ann.)</TableHead>
                <TableHead className="text-right">R²</TableHead>
                <TableHead className="text-right">IR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {book.nameCapm.map((row, i) => (
                <TableRow key={row.symbol}>
                  <TableCell className="font-mono">{row.symbol}</TableCell>
                  <TableCell className="text-right font-mono">{pct(book.weights[i] ?? 0, false)}</TableCell>
                  <TableCell className="text-right font-mono">{num(row.beta, 2)}</TableCell>
                  <TableCell className="text-right font-mono">{pct(row.alphaAnn, true)}</TableCell>
                  <TableCell className="text-right font-mono">{num(row.r2, 2)}</TableCell>
                  <TableCell className="text-right font-mono">{num(row.informationRatio * Math.sqrt(252), 2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kalman β vs SPY</CardTitle>
          <CardDescription>
            Scalar filter on r_book,t = β_t r_SPY,t + ε. Process variance 10⁻⁵, observation 10⁻⁴. Last β{" "}
            {num(lastKalman, 2)} vs OLS {num(book.bookCapm.beta, 2)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
            <ResponsiveContainer initialDimension={{ width: 800, height: 220 }}>
              <LineChart data={kalmanChart}>
                <XAxis dataKey="t" hide />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={40} />
                <Tooltip formatter={(v) => num(Number(v), 3)} />
                <Line type="monotone" dataKey="beta" stroke="#d4b483" dot={false} strokeWidth={1.6} />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Fama–French 3-factor</CardTitle>
          <CardDescription>
            Daily OLS: r − r_f = α + β_m (SPY − r_f) + β_s (IWM − SPY) + β_h (IWD − IWF). Book α{" "}
            {ff ? pct(annualizeAlphaDaily(ff.bookFf.alpha), true) : "—"} · R² {ff ? num(ff.bookFf.r2, 2) : "—"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ff ? (
            <p className="text-sm text-muted-foreground">Loading IWM / IWD / IWF histories for SMB and HML…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">α (ann.)</TableHead>
                  <TableHead className="text-right">β_m</TableHead>
                  <TableHead className="text-right">β_s</TableHead>
                  <TableHead className="text-right">β_h</TableHead>
                  <TableHead className="text-right">R²</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Book</TableCell>
                  <TableCell className="text-right font-mono">{pct(annualizeAlphaDaily(ff.bookFf.alpha), true)}</TableCell>
                  <TableCell className="text-right font-mono">{num(ff.bookFf.mkt, 2)}</TableCell>
                  <TableCell className="text-right font-mono">{num(ff.bookFf.smb, 2)}</TableCell>
                  <TableCell className="text-right font-mono">{num(ff.bookFf.hml, 2)}</TableCell>
                  <TableCell className="text-right font-mono">{num(ff.bookFf.r2, 2)}</TableCell>
                </TableRow>
                {ff.names.map((row) => (
                  <TableRow key={row.symbol}>
                    <TableCell className="font-mono">{row.symbol}</TableCell>
                    <TableCell className="text-right font-mono">{pct(annualizeAlphaDaily(row.alpha), true)}</TableCell>
                    <TableCell className="text-right font-mono">{num(row.mkt, 2)}</TableCell>
                    <TableCell className="text-right font-mono">{num(row.smb, 2)}</TableCell>
                    <TableCell className="text-right font-mono">{num(row.hml, 2)}</TableCell>
                    <TableCell className="text-right font-mono">{num(row.r2, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>PCA on correlation</CardTitle>
            <CardDescription>Jacobi eigen-decomposition of the shrunk correlation matrix.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PC</TableHead>
                  <TableHead className="text-right">λ</TableHead>
                  <TableHead className="text-right">Explained</TableHead>
                  <TableHead className="text-right">Cumulative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(book.pca?.eigenvalues ?? []).slice(0, 6).map((value, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">PC{i + 1}</TableCell>
                    <TableCell className="text-right font-mono">{num(value, 3)}</TableCell>
                    <TableCell className="text-right font-mono">{pct(book.pca?.explained[i], false)}</TableCell>
                    <TableCell className="text-right font-mono">{pct(book.pca?.cumulative[i], false)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Correlation</CardTitle>
            <CardDescription>From the Ledoit–Wolf annualized covariance.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th />
                  {book.names.map((s) => (
                    <th key={s} className="px-2 py-1 font-mono">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {book.names.map((a, i) => (
                  <tr key={a}>
                    <td className="px-2 py-1 font-mono">{a}</td>
                    {(book.corr[i] ?? []).map((v, j) => (
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
    </div>
  );
}
