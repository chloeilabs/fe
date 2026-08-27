"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchFmp } from "@/lib/fmp/browser";
import type { FmpNews } from "@/lib/fmp/types";
import { usePortfolio } from "@/lib/portfolio/store";

export function NewsView() {
  const { state } = usePortfolio();
  const [latest, setLatest] = useState<FmpNews[]>([]);
  const [book, setBook] = useState<FmpNews[]>([]);

  useEffect(() => {
    fetchFmp<FmpNews[]>("news/stock-latest", { limit: 20 }).then((res) => setLatest(res.data ?? []));
  }, []);

  useEffect(() => {
    const symbols = [...new Set(state.holdings.map((h) => h.symbol))].slice(0, 5).join(",");
    if (!symbols) return;
    fetchFmp<FmpNews[]>("news/stock", { symbols, limit: 12 }).then((res) => setBook(res.data ?? []));
  }, [state.holdings]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">News</p>
        <h1 className="font-heading text-4xl tracking-tight">What the tape is reading</h1>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <NewsCard title="Your book" items={book} />
        <NewsCard title="Market" items={latest} />
      </div>
    </div>
  );
}

function NewsCard({ title, items }: { title: string; items: FmpNews[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <article key={item.url ?? item.title}>
            <a href={item.url} target="_blank" rel="noreferrer" className="text-sm hover:text-primary">
              {item.title}
            </a>
            <div className="text-xs text-muted-foreground">
              {item.symbol ? (
                <Link href={`/research/${item.symbol}`} className="font-mono hover:underline">
                  {item.symbol}
                </Link>
              ) : null}{" "}
              {item.publisher} · {item.publishedDate}
            </div>
            {item.text ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.text}</p> : null}
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
