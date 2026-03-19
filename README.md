# RetirePlan

Production retirement planning web application.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- PostgreSQL + Prisma ORM (v7 with pg adapter)
- Auth.js v5 (JWT sessions)
- Tailwind CSS + shadcn/ui

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)

### Setup

1. Clone the repo
2. Copy environment file:
   ```bash
   cp .env.example .env.local
   ```
3. Fill in values in `.env.local`
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```
6. Seed the database:
   ```bash
   npx prisma db seed
   ```
7. Start the dev server:
   ```bash
   npm run dev
   ```

Demo account: `demo@retireplan.app` / `Password123!`

## Docker Build

```bash
docker build -t retirement-app .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  -e AUTH_URL="http://localhost:3000" \
  retirement-app
```

## Coolify Deployment

1. Push repo to GitHub
2. In Coolify, create a new Application
3. Connect the GitHub repo
4. Set environment variables:
   - `DATABASE_URL`
   - `AUTH_SECRET` (run `openssl rand -base64 32`)
   - `AUTH_URL` (your production domain)
   - `NODE_ENV=production`
5. Deploy

## Database Migrations (Production)

Add this to your Dockerfile CMD or as a pre-deploy hook:
```bash
npx prisma migrate deploy
```

## Project Structure

```
src/
  app/
    (auth)/         # Public auth pages
    (dashboard)/    # Protected app pages
    api/            # API routes
  components/       # Shared UI components
  lib/              # Auth, Prisma, validations
  services/         # Business logic layer
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed script
  migrations/       # Migration files
```

## Phase Architecture

| Phase | Capability |
|-------|-----------|
| 0–2 | Auth, household data model, financial data entry |
| 3 | Deterministic projection engine |
| 4 | Calculators (readiness, savings gap, income projection, withdrawal, years-to-retirement) |
| 5 | Scenario builder and what-if comparison |
| 6 | Monte Carlo simulation (probabilistic plan analysis) |
| 7 | Withdrawal strategy engine + sequence risk analysis |

## Phase 7 — Withdrawal Strategy Engine

Phase 7 adds a decumulation planning layer on top of the existing deterministic and Monte Carlo engines.

### Supported Withdrawal Strategies

- **Needs-Based**: Withdraw exactly the cash-flow gap each year (the existing engine default).
- **Fixed Nominal**: A constant annual dollar amount every year in retirement.
- **Fixed Real**: A fixed amount in today's dollars, inflated annually.
- **Inflation-Adjusted Spending**: Explicit alias for needs-based with inflation linkage.
- **Simple Guardrail**: Reduce spending when portfolio falls below a threshold; allow modest increases when above. Planning-grade approximation — not a branded framework.

### Withdrawal Ordering Strategies

- **Taxable First** (default): TAXABLE → TAX_DEFERRED → TAX_FREE → MIXED
- **Tax-Deferred First**: TAX_DEFERRED → TAXABLE → TAX_FREE → MIXED
- **Tax-Free First**: TAX_FREE → TAXABLE → TAX_DEFERRED → MIXED
- **Pro-Rata**: Proportional withdrawal across all accounts based on net-equivalent balances

### Sequence Risk Analysis

Pre-defined deterministic stress paths simulate bad early-retirement market returns:

| Path | Description |
|------|-------------|
| Early Crash | -20%, -10%, 0% in years 1-3, then baseline |
| Mild Early Weakness | -10%, -5%, +2% in years 1-3, then baseline |
| Delayed Crash | Normal for 5 years, then -25%, -10% |
| Double Dip | -15% in year 1, partial recovery, -20% in year 5 |
| Lost Decade | 10 years of flat to slightly negative returns |

### Architecture

The withdrawal strategy layer injects into the existing engine via optional parameters:

```
runDeterministicProjection(snapshot, {
  withdrawalPolicy: WithdrawalStrategyConfig,  // Phase 7
  orderingType: WithdrawalOrderingType,         // Phase 7
  annualReturns: number[],                      // Phase 6 (Monte Carlo)
})
```

This keeps one shared cash-flow engine. All phases share the same accounting order.

### v1 Documented Limitations

- Annual time-step model only (no monthly decumulation).
- Flat-rate tax assumptions (no bracket optimization, no RMD compliance engine).
- Guardrail is a simplified planning approximation — not Guyton-Klinger or any certified framework.
- No AI-generated advice, advanced Social Security optimization, or annuity modeling.
- Single portfolio-level return per year (no per-account allocation modeling).

### Routes

| Route | Description |
|-------|-------------|
| `/app/withdrawal-strategies` | List prior strategy runs |
| `/app/withdrawal-strategies/new` | Configure and run a new strategy analysis |
| `/app/withdrawal-strategies/[runId]` | View full results with year-by-year detail |
| `/app/withdrawal-strategies/compare` | Side-by-side comparison of two strategy runs |
| `/app/sequence-risk` | Sequence-of-returns risk stress testing |

### Testing

Phase 7 adds 42 tests covering:
- Policy engine (all 5 strategy types, edge cases)
- Ordering service (all 4 orderings, tax gross-up, shortfall)
- Engine integration (policy injection, ordering injection, sequence risk vectors)
- Stress path structure validation
- Input validation
- 6 golden planning cases

## Phase 10 — Healthcare Cost Modeling + Longevity Stress Testing

### What's included

- **Pre-Medicare cost modeling**: Estimates annual healthcare costs for members not yet eligible for Medicare (typically before age 65). Handles couples with different Medicare eligibility timing.
- **Medicare-era cost modeling**: Models Part B, Part D, Medigap/Advantage premiums and out-of-pocket costs. Includes planning-grade IRMAA surcharge estimation.
- **Healthcare inflation**: Separate healthcare inflation assumption (default 5%/yr) applies to all healthcare cost components throughout the projection.
- **Longevity stress testing**: Extends the projection timeline to age 90, 95, 100, or custom target. Works for primary member, spouse, or both.
- **Long-term care stress cases**: Injects a configurable annual care-cost spike for a defined duration starting at a defined age. Based on Genworth 2024 national LTC cost averages.
- **Survivor integration**: Healthcare cost modeling continues in survivor-appropriate form after a spouse death event.
- **Comparison layer**: Side-by-side A/B comparison of healthcare/longevity runs with config diffs, outcome diffs, and year-by-year delta.

### Services

| Service | Responsibility |
|---|---|
| `healthcareAssumptionService` | Load and validate effective healthcare assumptions |
| `preMedicareCostService` | Pre-Medicare cost estimation |
| `medicareCostService` | Medicare-era cost estimation |
| `healthcareInflationService` | Healthcare inflation application |
| `longevityStressService` | Longevity timeline extension |
| `longTermCareStressService` | LTC stress cost injection |
| `healthcarePlanningService` | Main orchestration |
| `healthcareComparisonService` | A/B comparison |

### Key limitations (v1)

- Planning-grade approximations; not medical, insurance, or Medicare enrollment advice
- Annual time-step model; no monthly billing detail
- Simplified healthcare inflation (single rate for all healthcare categories)
- Simplified LTC stress (annual spike, not insurance policy modeling)
- IRMAA: planning-grade single-tier surcharge, not exact IRMAA bracket calculation
- No Medicaid planning or spend-down modeling
- No AI interpretation of health risk factors

### UI pages

| Route | Description |
|---|---|
| `/app/healthcare-planning` | Index: prior runs + create new |
| `/app/healthcare-planning/new` | Create new analysis |
| `/app/healthcare-planning/[runId]` | Run detail with year-by-year table |
| `/app/healthcare-planning/compare` | A/B comparison |
| `/app/longevity-stress` | Longevity stress runs |
| `/app/long-term-care-stress` | LTC stress runs |
