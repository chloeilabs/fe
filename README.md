# Compound

A personal financial-engineering workbench for wealth growth. It marks your book to [Financial Modeling Prep](https://site.financialmodelingprep.com/api-docs.md) market data, then runs the mean-variance, risk, valuation, and time-series math on that book.

This is not a FIRE planner. `/planner` redirects to Optimize.

## What it does

- **Desk** — net worth, daily P/L, Sharpe, 95% historical VaR, allocation vs GMV, tape, watchlist
- **Book** — holdings, cost basis, cash, sleeves (local to the browser)
- **Optimize** — GMV, max Sharpe, ERC, min empirical CVaR, Black–Litterman, efficient frontier, dollar trades, Student-t wealth paths, ½-Kelly
- **Lab** — GARCH(1,1) on the book, Nelson–Siegel on Treasuries, Engle–Granger (last z), Brinson–Fachler vs policy, walk-forward EW/GMV/max-Sharpe/ERC, ETF look-through
- **Research** — quote, two-stage FCFF vs FMP DCF, Edwards–Bell–Ohlson residual income, Gordon DPS, owner earnings, grades, financial growth, SUE, market-adjusted earnings CAR, price targets, ratings, US ERP, sector-relative P/E
- **Screen** — `stable/company-screener` with quality / dividend / ETF presets
- **Risk** — hist / parametric / Cornish–Fisher VaR, EWMA vol, OLS CAPM, Kalman β vs SPY, Fama–French 3-factor (IWM/IWD/IWF), PCA, correlation
- **Tape** — indexes, sectors, sector P/E, movers, Nelson–Siegel overlay on the Treasury curve, US macro, economic calendar
- **News** — book-specific and market-wide FMP stock news

The FMP API key never leaves the server. The browser talks only to `/api/fmp`.

## Engines

Ledoit–Wolf covariance, GMV / max-Sharpe / ERC / min-CVaR / Black–Litterman, historical and Cornish–Fisher VaR, CAPM + Kalman β, Fama–French 3-factor OLS, Jacobi PCA, two-stage FCFF, residual income, Gordon DPS, GARCH(1,1), Nelson–Siegel (Diebold–Li), Engle–Granger, earnings CAR, Brinson–Fachler, walk-forward backtest, multivariate-t Monte Carlo, Kelly.

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
