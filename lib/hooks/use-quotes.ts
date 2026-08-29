"use client";

import { useEffect, useState } from "react";

import { fetchFmp } from "@/lib/fmp/browser";
import type { FmpQuote } from "@/lib/fmp/types";

export function useQuotes(symbols: string[]) {
  const key = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].sort().join(",");
  const [loaded, setLoaded] = useState<{ key: string; quotes: Record<string, FmpQuote>; mode: "live" | "sample" }>({
    key: "",
    quotes: {},
    mode: "sample",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchFmp<FmpQuote[]>("batch-quote", { symbols: key })
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, FmpQuote> = {};
        for (const q of res.data ?? []) map[q.symbol] = q;
        setLoaded({ key, quotes: map, mode: res.mode });
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return {
    quotes: key ? loaded.quotes : {},
    mode: loaded.mode,
    error,
    loading: Boolean(key) && loaded.key !== key,
  };
}
