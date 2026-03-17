# Phase 3: Deterministic Projection Engine

## Overview

Phase 3 adds a year-by-year retirement projection engine. Given the household financial data collected in Phases 1 and 2, the engine projects the household forward from the current year through each member's life expectancy, computing income, expenses, withdrawals, taxes, and portfolio balances for every year.

## Architecture

### New Schema Model
`SimulationRun` stores each projection execution with frozen snapshot input (`snapshotJson`) and full year-by-year output (`outputJson`), plus denormalized summary fields for fast querying.

### Engine Pipeline

1. **`buildSimulationSnapshot`** — loads all household data from Postgres and normalizes it into a `SimulationSnapshot` struct (immutable engine input).
2. **`validateSimulationInputs`** — checks the snapshot for structural errors before running.
3. **`runDeterministicProjection`** — core engine; iterates year by year:
   - Determines member ages, alive/retired status
   - Computes earned income (stops at retirement for non-passive sources)
   - Computes benefit income (activates at claim age or start year, grows with COLA)
   - Computes inflation-adjusted expenses
   - Computes taxes via flat effective rate
   - Calculates required withdrawal (gap between outflows and inflows)
   - Draws withdrawals in tax-efficiency order: TAXABLE → TAX_DEFERRED → TAX_FREE
   - Updates account balances using mid-year convention for contributions and withdrawals
   - Updates liability balances with simple amortization
4. **`simulationService`** — orchestrates build → validate → run → persist.

### API Routes
- `GET /api/simulations` — list runs for household
- `POST /api/simulations` — trigger new run (returns `runId`)
- `GET /api/simulations/[runId]` — fetch full run with output
- `GET /api/simulations/validate` — validate inputs without running

### UI Pages
- `/app/simulations` — list runs, show validation status, trigger new run
- `/app/simulations/[runId]` — summary cards, SVG line charts, paginated year-by-year table

## Key Design Decisions

- All rate fields (`inflationRate`, `expectedPortfolioReturn`, `assumedTaxRate`, etc.) are stored as decimal fractions in the DB (e.g. `0.0300` = 3%) and used directly.
- All expense profile fields are monthly in the DB; multiplied by 12 during normalization.
- Tax-deferred withdrawals are grossed up so the net-of-tax amount covers the cash flow gap.
- Mid-year convention: contributions and withdrawals earn/cost half a year's return.
- The engine stops early if all members have exceeded their life expectancy.
