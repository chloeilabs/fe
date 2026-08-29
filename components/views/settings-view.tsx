"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fetchFmp } from "@/lib/fmp/browser";
import { usePortfolio } from "@/lib/portfolio/store";
import type { PortfolioState } from "@/lib/portfolio/types";

export function SettingsView() {
  const { state, replaceAll, resetSeed } = usePortfolio();
  const [mode, setMode] = useState<"live" | "sample">("sample");
  const [configured, setConfigured] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const bookJson = JSON.stringify(state, null, 2);

  useEffect(() => {
    fetchFmp("status").then((res) => {
      setMode(res.mode);
      setConfigured(Boolean(res.configured));
    });
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Settings</p>
        <h1 className="font-heading text-4xl tracking-tight">Data, key, and the book</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Financial Modeling Prep</CardTitle>
          <CardDescription>
            The API key stays on the server as <code>FMP_API_KEY</code>. Client calls only hit <code>/api/fmp</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Status: <strong>{configured ? "key configured" : "no key"}</strong> · mode <strong>{mode}</strong>
          </p>
          <p className="text-muted-foreground">
            Create a free key at{" "}
            <a className="underline" href="https://site.financialmodelingprep.com/register" target="_blank" rel="noreferrer">
              financialmodelingprep.com
            </a>{" "}
            and set it in the environment. Docs:{" "}
            <a className="underline" href="https://site.financialmodelingprep.com/api-docs.md" target="_blank" rel="noreferrer">
              stable API
            </a>
            . Base URL used by this app: <code>https://financialmodelingprep.com/stable/</code>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Import / export book</CardTitle>
          <CardDescription>Holdings, cash, and watchlist are local JSON. Nothing is sent to FMP except tickers you look up.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea className="min-h-64 font-mono text-xs" value={draft ?? bookJson} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                try {
                  const parsed = JSON.parse(draft ?? bookJson) as PortfolioState;
                  replaceAll(parsed);
                  setDraft(null);
                  toast.success("Book replaced");
                } catch {
                  toast.error("Invalid JSON");
                }
              }}
            >
              Import JSON
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
            <Button variant="destructive" onClick={() => resetSeed()}>
              Reset to seed book
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
