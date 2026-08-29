"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

import { DeltaFromPercent } from "@/components/delta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ASSET_CLASSES, ASSET_CLASS_LABELS, type AssetClass } from "@/lib/engine/allocation";
import { money, shares as fmtShares } from "@/lib/format";
import { useQuotes } from "@/lib/hooks/use-quotes";
import { ACCOUNT_LABELS, ACCOUNTS, createId, type AccountType, type Holding } from "@/lib/portfolio/types";
import { usePortfolio } from "@/lib/portfolio/store";

const emptyForm = {
  symbol: "",
  name: "",
  shares: "1",
  costPerShare: "",
  account: "taxable" as AccountType,
  assetClass: "us-equity" as AssetClass,
};

export function PortfolioView() {
  const { state, upsertHolding, removeHolding, setCash } = usePortfolio();
  const { quotes } = useQuotes(state.holdings.map((h) => h.symbol));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [cashDraft, setCashDraft] = useState(String(state.cash));

  const rows = state.holdings.map((h) => {
    const price = quotes[h.symbol]?.price ?? h.costPerShare;
    const value = h.shares * price;
    const cost = h.shares * h.costPerShare;
    return { ...h, price, value, cost, pnl: value - cost, weight: 0 };
  });
  const invested = rows.reduce((s, r) => s + r.value, 0);
  const total = invested + state.cash;

  function submit() {
    const holding: Holding = {
      id: editing ?? createId(),
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim() || form.symbol.trim().toUpperCase(),
      shares: Number(form.shares) || 0,
      costPerShare: Number(form.costPerShare) || quotes[form.symbol.toUpperCase()]?.price || 0,
      account: form.account,
      assetClass: form.assetClass,
    };
    if (!holding.symbol || holding.shares <= 0) return;
    upsertHolding(holding);
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function edit(h: Holding) {
    setEditing(h.id);
    setForm({
      symbol: h.symbol,
      name: h.name,
      shares: String(h.shares),
      costPerShare: String(h.costPerShare),
      account: h.account,
      assetClass: h.assetClass,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">The book</p>
          <h1 className="font-heading text-4xl tracking-tight">Holdings and cost basis</h1>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add position
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
          <CardDescription>
            {money(total)} marked value · {money(state.cash)} cash. Data stays in this browser unless you export it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">P/L</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <button type="button" className="text-left" onClick={() => edit(row)}>
                      <div className="font-mono">{row.symbol}</div>
                      <div className="text-xs text-muted-foreground">{row.name}</div>
                    </button>
                  </TableCell>
                  <TableCell>{ACCOUNT_LABELS[row.account]}</TableCell>
                  <TableCell>{ASSET_CLASS_LABELS[row.assetClass]}</TableCell>
                  <TableCell className="text-right font-mono">{fmtShares(row.shares)}</TableCell>
                  <TableCell className="text-right font-mono">{money(row.price)}</TableCell>
                  <TableCell className="text-right font-mono">{money(row.value)}</TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono">{money(row.pnl)}</div>
                    <DeltaFromPercent value={row.cost ? (row.pnl / row.cost) * 100 : 0} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/research/${row.symbol}`} className="text-xs text-muted-foreground hover:text-foreground">
                        Research
                      </Link>
                      <Button variant="ghost" size="icon-xs" onClick={() => removeHolding(row.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <form
            className="flex max-w-sm items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setCash(Number(cashDraft) || 0);
            }}
          >
            <div className="flex-1">
              <Label htmlFor="cash">Cash</Label>
              <Input id="cash" value={cashDraft} onChange={(e) => setCashDraft(e.target.value)} />
            </div>
            <Button type="submit" variant="outline">
              Save cash
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit position" : "Add position"}</DialogTitle>
            <DialogDescription>Cost basis is yours. Last price comes from FMP.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Label htmlFor="symbol">Symbol</Label>
              <Input id="symbol" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="shares">Shares</Label>
              <Input id="shares" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cost">Cost / share</Label>
              <Input id="cost" value={form.costPerShare} onChange={(e) => setForm({ ...form, costPerShare: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="account">Account</Label>
              <select
                id="account"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value as AccountType })}
              >
                {ACCOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {ACCOUNT_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="class">Asset class</Label>
              <select
                id="class"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.assetClass}
                onChange={(e) => setForm({ ...form, assetClass: e.target.value as AssetClass })}
              >
                {ASSET_CLASSES.map((a) => (
                  <option key={a} value={a}>
                    {ASSET_CLASS_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save position</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
