"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { fetchFmp } from "@/lib/fmp/browser";

export function SampleBanner() {
  const [mode, setMode] = useState<"live" | "sample" | null>(null);

  useEffect(() => {
    fetchFmp("status")
      .then((res) => setMode(res.mode))
      .catch(() => setMode("sample"));
  }, []);

  if (mode !== "sample") return null;
  return (
    <div className="border-b border-amber-500/20 bg-amber-500/8 px-4 py-2 text-center text-sm text-amber-200/90">
      Showing FMP sample mode because <code className="font-mono">FMP_API_KEY</code> is not set.{" "}
      <Link href="/settings" className="underline underline-offset-4">
        Add a key
      </Link>{" "}
      for live quotes, financials, and screening.
    </div>
  );
}
