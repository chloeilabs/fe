"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { fetchFmp } from "@/lib/fmp/browser";
import type { FmpSearchHit } from "@/lib/fmp/types";

export function SymbolSearch({
  autoFocus,
  onPick,
}: {
  autoFocus?: boolean;
  onPick?: (hit: FmpSearchHit) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FmpSearchHit[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) return;
    const handle = window.setTimeout(() => {
      fetchFmp<FmpSearchHit[]>("search-symbol", { query: q, limit: 8 })
        .then((res) => setHits(Array.isArray(res.data) ? res.data : []))
        .catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  const shown = useMemo(() => (query.trim() ? hits.slice(0, 8) : []), [hits, query]);

  return (
    <div className="relative w-full max-w-xl">
      <Input
        autoFocus={autoFocus}
        value={query}
        placeholder="Search ticker or name — AAPL, VTI, Microsoft"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && shown[0]) {
            onPick?.(shown[0]);
            router.push(`/research/${encodeURIComponent(shown[0].symbol)}`);
            setOpen(false);
          }
        }}
      />
      {open && shown.length > 0 ? (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl bg-popover ring-1 ring-foreground/10">
          {shown.map((hit) => (
            <li key={`${hit.symbol}-${hit.exchange}`}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                onClick={() => {
                  onPick?.(hit);
                  router.push(`/research/${encodeURIComponent(hit.symbol)}`);
                  setOpen(false);
                }}
              >
                <span className="font-mono text-sm">{hit.symbol}</span>
                <span className="truncate pl-4 text-xs text-muted-foreground">{hit.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
