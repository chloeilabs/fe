"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Kpi } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ASSET_CLASSES,
  ASSET_CLASS_LABELS,
  driftScore,
  rebalancePlan,
  type AssetClass,
} from "@/lib/engine/allocation";
import {
  coastFireValue,
  fireNumber,
  futureValue,
  glidepathEquity,
  monteCarloProjection,
  requiredMonthlyContribution,
  savingsRate,
  yearsToTarget,
} from "@/lib/engine/wealth";
import { money, num, pct } from "@/lib/format";
import { ClientOnly } from "@/lib/hooks/use-mounted";
import { useQuotes } from "@/lib/hooks/use-quotes";
import { usePortfolio } from "@/lib/portfolio/store";
import type { GoalPlan } from "@/lib/portfolio/types";

function field(goals: GoalPlan, key: keyof GoalPlan, label: string, onChange: (g: GoalPlan) => void, scale = 1) {
  return (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        step="any"
        value={Number.isFinite(goals[key]) ? Number(goals[key]) * (scale === 1 ? 1 : 100) : ""}
        onChange={(e) =>
          onChange({
            ...goals,
            [key]: (Number(e.target.value) || 0) / (scale === 1 ? 1 : 100),
          })
        }
      />
    </div>
  );
}

export function PlannerView() {
  const { state, setGoals, setTarget } = usePortfolio();
  const { quotes } = useQuotes(state.holdings.map((h) => h.symbol));
  const g = state.goals;
  const present = state.holdings.reduce((s, h) => s + h.shares * (quotes[h.symbol]?.price ?? h.costPerShare), 0) + state.cash;
  const yearsLeft = Math.max(0, g.retirementAge - g.currentAge);
  const fire = fireNumber(g.annualSpend, g.safeWithdrawalRate);
  const years = yearsToTarget({
    presentValue: present,
    monthlyContribution: g.monthlyContribution,
    annualReturn: g.expectedReturn,
    inflation: g.inflation,
    target: fire,
    contributionGrowth: g.contributionGrowth,
  });
  const needed = requiredMonthlyContribution({
    presentValue: present,
    annualReturn: g.expectedReturn,
    inflation: g.inflation,
    years: yearsLeft || 1,
    target: fire,
  });
  const coast = coastFireValue({
    target: fire,
    annualReturn: g.expectedReturn,
    inflation: g.inflation,
    yearsToRetirement: yearsLeft,
  });
  const fv = futureValue({
    presentValue: present,
    monthlyContribution: g.monthlyContribution,
    annualReturn: g.expectedReturn,
    inflation: g.inflation,
    years: yearsLeft,
    contributionGrowth: g.contributionGrowth,
  });
  const mc = monteCarloProjection({
    presentValue: present,
    monthlyContribution: g.monthlyContribution,
    annualReturn: g.expectedReturn,
    inflation: g.inflation,
    years: Math.max(yearsLeft, 1),
    contributionGrowth: g.contributionGrowth,
    annualVolatility: g.expectedVol,
    paths: 500,
    seed: 11,
    target: fire,
  });
  const chart = mc.years.map((year, i) => ({
    year: g.currentAge + year,
    p10: mc.p10[i],
    p50: mc.p50[i],
    p90: mc.p90[i],
  }));

  const classValues = [
    ...state.holdings.map((h) => ({
      assetClass: h.assetClass,
      value: h.shares * (quotes[h.symbol]?.price ?? h.costPerShare),
    })),
    { assetClass: "cash" as AssetClass, value: state.cash },
  ];
  const plan = rebalancePlan(classValues, state.target);
  const drift = driftScore(plan.lines);
  const suggestedEquity = glidepathEquity(g.currentAge, g.retirementAge);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">The plan</p>
        <h1 className="font-heading text-4xl tracking-tight">Engineer the compounding path</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Real (inflation-adjusted) projections, a Monte Carlo fan, and the monthly savings that actually fund your FIRE number.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="FIRE number" value={money(fire)} hint={`${money(g.annualSpend)} spend / ${num(g.safeWithdrawalRate * 100, 1)}% SWR`} />
        <Kpi label="Years to fund" value={years == null ? "Not on path" : num(years, 1)} hint={`Coast FIRE capital today: ${money(coast, true)}`} />
        <Kpi label="Required monthly" value={money(needed)} hint={`Current ${money(g.monthlyContribution)} · savings rate ${pct(savingsRate(g.monthlyContribution, g.annualIncome), false)}`} />
        <Kpi label="Median at retirement" value={money(mc.medianEnd, true)} hint={`${pct(mc.successRate, false)} of paths clear the nest egg`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <CardDescription>Stored locally with the book.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {field(g, "currentAge", "Current age", setGoals)}
            {field(g, "retirementAge", "Retirement age", setGoals)}
            {field(g, "annualIncome", "Annual income", setGoals)}
            {field(g, "annualSpend", "Annual spend in retirement", setGoals)}
            {field(g, "monthlyContribution", "Monthly contribution", setGoals)}
            {field(g, "contributionGrowth", "Contribution growth %", setGoals, 100)}
            {field(g, "expectedReturn", "Expected return %", setGoals, 100)}
            {field(g, "expectedVol", "Volatility %", setGoals, 100)}
            {field(g, "inflation", "Inflation %", setGoals, 100)}
            {field(g, "safeWithdrawalRate", "SWR %", setGoals, 100)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monte Carlo fan</CardTitle>
            <CardDescription>
              Geometric Brownian motion with your return/vol, monthly contributions, real dollars. Deterministic path at retirement: {money(fv)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ClientOnly fallback={<div className="h-full rounded-lg bg-muted/30" />}>
            <ResponsiveContainer initialDimension={{ width: 640, height: 280 }}>
              <AreaChart data={chart}>
                <CartesianGrid strokeOpacity={0.12} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => money(Number(v), true)} tick={{ fontSize: 11 }} width={72} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Area type="monotone" dataKey="p90" stroke="transparent" fill="#d4b483" fillOpacity={0.12} />
                <Area type="monotone" dataKey="p10" stroke="transparent" fill="#0c0b09" fillOpacity={1} />
                <Area type="monotone" dataKey="p50" stroke="#d4b483" fill="#d4b483" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
            </ClientOnly>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Target mix and rebalance</CardTitle>
          <CardDescription>
            Age-based equity glidepath suggestion: {num(suggestedEquity * 100, 0)}% risk assets. Current drift {pct(drift, false)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Now</TableHead>
                <TableHead className="text-right">Target %</TableHead>
                <TableHead className="text-right">Trade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.lines.map((line) => (
                <TableRow key={line.assetClass}>
                  <TableCell>{ASSET_CLASS_LABELS[line.assetClass]}</TableCell>
                  <TableCell className="text-right font-mono">{pct(line.currentWeight, false)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      className="ml-auto max-w-24 text-right"
                      value={num((state.target[line.assetClass] ?? 0) * 100, 1)}
                      onChange={(e) =>
                        setTarget({
                          ...state.target,
                          [line.assetClass]: (Number(e.target.value) || 0) / 100,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">{money(line.dollars)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Positive trade = buy toward target. Negative = trim. {ASSET_CLASSES.length} sleeves, including unused ones so you can turn on crypto/REITs later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
