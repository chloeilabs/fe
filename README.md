# Compound

A personal financial-engineering workbench for wealth growth. It marks your book to [Financial Modeling Prep](https://site.financialmodelingprep.com/api-docs.md) market data, then runs the mean-variance, risk, valuation, and time-series math on that book.

This is not a FIRE planner. `/planner` redirects to Optimize.

## What it does

- **Desk** — net worth, daily P/L, Sharpe, 95% historical VaR, allocation vs GMV, upcoming book dividends, tape, watchlist
- **Book** — holdings, cost basis, cash, sleeves (local to the browser)
- **Optimize** — GMV, max Sharpe, ERC, min empirical CVaR, Treynor–Black residual-α overlay, Black–Litterman, efficient frontier, dollar trades, Student-t wealth paths, ½-Kelly
- **Lab** — GARCH(1,1) on the book, Nelson–Siegel plus zero duration/convexity, Engle–Granger (last z), Brinson–Fachler vs policy, walk-forward EW/GMV/max-Sharpe/ERC, ETF look-through including country weights
- **Research** — quote, two-stage FCFF vs FMP DCF and levered DCF, residual income, Gordon DPS, owner earnings, float, enterprise value, geographic/product HHI, historical market-cap CAGR, grades, financial growth, SUE, market-adjusted earnings CAR, price-target path, ratings, US ERP, sector- and industry-relative P/E
- **Screen** — `stable/company-screener` with quality / dividend / ETF presets
- **Risk** — hist / parametric / Cornish–Fisher VaR, EWMA vol, Parkinson / Garman–Klass / Yang–Zhang range vol, Amihud, Roll implied spread, 12–1 momentum, Newey–West t(α), OLS CAPM, Kalman β vs SPY, Fama–French 3-factor (IWM/IWD/IWF), PCA, correlation
- **Tape** — indexes, sectors, sector and industry P/E, industry tape, Fed-model earnings-yield gap (NASDAQ sector E/P vs 10y), book dividend calendar, movers, Nelson–Siegel overlay on the Treasury curve, US macro, economic calendar
- **News** — book-specific and market-wide FMP stock news

The FMP API key never leaves the server. The browser talks only to `/api/fmp`.

## Engines

Ledoit–Wolf covariance, GMV / max-Sharpe / ERC / min-CVaR / Treynor–Black / Black–Litterman, historical and Cornish–Fisher VaR, Parkinson / Garman–Klass / Yang–Zhang, Amihud, Roll implied spread, Newey–West HAC, CAPM + Kalman β, Fama–French 3-factor OLS, Jacobi PCA, two-stage FCFF, residual income, Gordon DPS, Herfindahl concentration, GARCH(1,1), Nelson–Siegel (Diebold–Li) plus zero duration/convexity, earnings-yield gap, Engle–Granger, earnings CAR, Brinson–Fachler, walk-forward backtest, multivariate-t Monte Carlo, Kelly.

## Setup

```bash
npm install
cp .env.example .env.local
# set FMP_API_KEY from https://site.financialmodelingprep.com/register
npm run dev
```

Without a key the app runs in **sample mode**. Add `FMP_API_KEY` for live `https://financialmodelingprep.com/stable/` data.

## Scripts

- `npm run dev` — Next.js 16 (Turbopack)
- `npm test` — quant engine identity tests
- `npm run build` — production build
- `npm run lint` — ESLint

Personal holdings stay in `localStorage` (`compound.portfolio.v1`). Export/import JSON from Settings.
