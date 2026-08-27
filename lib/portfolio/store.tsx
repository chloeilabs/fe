"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

import { DEFAULT_TARGET } from "@/lib/engine/allocation";
import {
  DEFAULT_GOALS,
  SEED_PORTFOLIO,
  createId,
  type GoalPlan,
  type Holding,
  type PortfolioState,
} from "@/lib/portfolio/types";
import type { TargetAllocation } from "@/lib/engine/allocation";

const STORAGE_KEY = "compound.portfolio.v1";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

function getServerSnapshot() {
  return "";
}

function parseState(raw: string | null): PortfolioState {
  if (!raw) return structuredClone(SEED_PORTFOLIO);
  try {
    const parsed = JSON.parse(raw) as Partial<PortfolioState>;
    return {
      version: 1,
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
      cash: typeof parsed.cash === "number" ? parsed.cash : 0,
      watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
      target: { ...DEFAULT_TARGET, ...(parsed.target ?? {}) },
      goals: { ...DEFAULT_GOALS, ...(parsed.goals ?? {}) },
    };
  } catch {
    return structuredClone(SEED_PORTFOLIO);
  }
}

function writeState(next: PortfolioState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, version: 1 }));
  emit();
}

type PortfolioContextValue = {
  ready: boolean;
  state: PortfolioState;
  setHoldings: (holdings: Holding[]) => void;
  upsertHolding: (holding: Omit<Holding, "id"> & { id?: string }) => void;
  removeHolding: (id: string) => void;
  setCash: (cash: number) => void;
  setWatchlist: (symbols: string[]) => void;
  toggleWatch: (symbol: string) => void;
  setTarget: (target: TargetAllocation) => void;
  setGoals: (goals: GoalPlan) => void;
  replaceAll: (state: PortfolioState) => void;
  resetSeed: () => void;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const state = useMemo(() => parseState(raw), [raw]);
  const ready = true;

  const replaceAll = useCallback((next: PortfolioState) => {
    writeState(next);
  }, []);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      ready,
      state,
      setHoldings: (holdings) => writeState({ ...state, holdings }),
      upsertHolding: (holding) => {
        const id = holding.id ?? createId();
        const next: Holding = { ...holding, id, symbol: holding.symbol.toUpperCase() };
        const idx = state.holdings.findIndex((h) => h.id === id);
        const holdings = idx >= 0 ? state.holdings.map((h, i) => (i === idx ? next : h)) : [...state.holdings, next];
        writeState({ ...state, holdings });
      },
      removeHolding: (id) => writeState({ ...state, holdings: state.holdings.filter((h) => h.id !== id) }),
      setCash: (cash) => writeState({ ...state, cash }),
      setWatchlist: (watchlist) => writeState({ ...state, watchlist }),
      toggleWatch: (symbol) => {
        const upper = symbol.toUpperCase();
        const exists = state.watchlist.includes(upper);
        writeState({
          ...state,
          watchlist: exists ? state.watchlist.filter((x) => x !== upper) : [...state.watchlist, upper],
        });
      },
      setTarget: (target) => writeState({ ...state, target }),
      setGoals: (goals) => writeState({ ...state, goals }),
      replaceAll,
      resetSeed: () => replaceAll(structuredClone(SEED_PORTFOLIO)),
    }),
    [ready, replaceAll, state],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}
