# Compound

A personal financial engineering desk for wealth growth. It marks your book to [Financial Modeling Prep](https://site.financialmodelingprep.com/api-docs.md) market data, then runs the compounding, allocation, and risk math that actually decides whether you get there.

## What it does

- **Desk** — net worth, daily P/L, allocation, FIRE progress, indexes, watchlist
- **Book** — holdings, cost basis, cash, account sleeves (local to the browser)
- **Plan** — inflation-adjusted projections, required savings, Coast FIRE, Monte Carlo fan, rebalance trades
- **Research** — FMP quote, profile, DCF vs price, TTM ratios, Altman Z / Piotroski, financials, peers, news
- **Screen** — `stable/company-screener` with quality / dividend / ETF presets
- **Risk** — value-weighted vol, Sharpe/Sortino, max drawdown, beta vs SPY, correlation, effective N
- **Tape** — indexes, sector snapshot, movers, Treasury curve, NASDAQ hours
- **News** — book-specific and market-wide FMP stock news

The FMP API key never leaves the server. The browser talks only to `/api/fmp`.

## Setup

```bash
npm install
cp .env.example .env.local
# set FMP_API_KEY from https://site.financialmodelingprep.com/register
npm run dev
```

Without a key the app runs in **sample mode** so the desk is still usable. Add `FMP_API_KEY` for live `https://financialmodelingprep.com/stable/` data.

## Scripts

- `npm run dev` — Next.js 16 (Turbopack)
- `npm test` — wealth / risk / allocation engines
- `npm run build` — production build
- `npm run lint` — ESLint

Personal holdings stay in `localStorage` (`compound.portfolio.v1`). Export/import JSON from Settings.
