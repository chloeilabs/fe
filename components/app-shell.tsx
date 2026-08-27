"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  CandlestickChart,
  Compass,
  Gauge,
  Landmark,
  LineChart,
  Newspaper,
  Settings,
} from "lucide-react";

import { SampleBanner } from "@/components/sample-banner";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Desk", icon: Landmark },
  { href: "/portfolio", label: "Book", icon: BookOpen },
  { href: "/planner", label: "Plan", icon: Gauge },
  { href: "/research", label: "Research", icon: CandlestickChart },
  { href: "/screener", label: "Screen", icon: Compass },
  { href: "/risk", label: "Risk", icon: Activity },
  { href: "/markets", label: "Tape", icon: LineChart },
  { href: "/news", label: "News", icon: Newspaper },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="border-b border-border/80 bg-sidebar lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <Link href="/" className="block">
            <div className="font-heading text-2xl tracking-tight text-primary">Compound</div>
            <div className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Wealth desk</div>
          </Link>
          <Link href="/settings" className="lg:hidden">
            <Settings className="size-4 text-muted-foreground" />
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-1 lg:flex-col lg:px-3">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/settings"
            className={cn(
              "mt-auto hidden items-center gap-2 rounded-lg px-3 py-2 text-sm lg:flex",
              pathname.startsWith("/settings")
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <SampleBanner />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
