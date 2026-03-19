# RetirePlan

Production retirement planning web application.

## Tech Stack

- **Next.js 14** (App Router, standalone output)
- **TypeScript** (strict mode)
- **PostgreSQL 16** + **Prisma ORM v6**
- **Auth.js v5** (JWT sessions, Prisma adapter)
- **Tailwind CSS v4** + **shadcn/ui**
- **OpenAI / Anthropic** (AI insights + copilot chat)
- **Stripe** (subscription billing — FREE / PRO / ADVISOR tiers)
- **Resend** (transactional email + digest notifications)
- **Vitest** (unit testing)

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
3. Fill in values in `.env.local` (see Environment Variables below)
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

### npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run Vitest unit tests |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
AUTH_SECRET=                       # Required: openssl rand -base64 32
AUTH_URL=https://yourdomain.com
DATABASE_URL=postgresql://user:password@localhost:5432/retirement_app

# AI (one provider required)
AI_PROVIDER=openai                 # openai | anthropic
AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...       # Required if AI_PROVIDER=anthropic

# Logging
LOG_LEVEL=info                     # debug | info | warn | error

# Stripe (billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ADVISOR_PRICE_ID=price_...

# Resend (email / notifications)
RESEND_API_KEY=re_...

# Background jobs
NOTIFICATION_JOB_SECRET=          # Random secret for job auth
```

> **Note:** `NODE_ENV` is set internally by the Dockerfile and `docker-entrypoint.sh`. Do not add it to Coolify env vars.

## Docker Build

The Dockerfile is a two-stage Alpine build. Database migrations run automatically at container start via `docker-entrypoint.sh`.

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
2. In Coolify, create a new Application from the GitHub repo
3. Set the following environment variables in Coolify:

   | Variable | Notes |
   |----------|-------|
   | `DATABASE_URL` | Internal Coolify DB URL |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_URL` | Your production domain |
   | `AI_PROVIDER` | `openai` or `anthropic` |
   | `AI_MODEL` | e.g. `gpt-4o-mini` |
   | `OPENAI_API_KEY` | Required if provider is OpenAI |
   | `STRIPE_SECRET_KEY` | Stripe live/test secret |
   | `STRIPE_PUBLISHABLE_KEY` | Stripe live/test publishable |
   | `STRIPE_WEBHOOK_SECRET` | From Stripe webhook config |
   | `STRIPE_PRO_PRICE_ID` | Stripe Price ID for PRO tier |
   | `STRIPE_ADVISOR_PRICE_ID` | Stripe Price ID for ADVISOR tier |
   | `RESEND_API_KEY` | Resend API key |
   | `NOTIFICATION_JOB_SECRET` | Random secret string |
   | `NEXT_PUBLIC_APP_URL` | Your production domain |

4. Set the healthcheck start period to **180 seconds** (allows time for `prisma migrate deploy` to complete before healthcheck fires)
5. Deploy

Database migrations run automatically on every container start via `docker-entrypoint.sh`:
```sh
node /prisma-cli/node_modules/prisma/build/index.js migrate deploy
exec node server.js
```

## Project Structure

```
src/
  app/
    (auth)/              # Public auth pages (sign in, sign up)
    api/                 # API routes (~72 endpoints)
    app/                 # Protected dashboard pages (~56 pages)
    invite/              # Invitation accept flow
  components/
    ai/                  # AI insight cards, chat UI
    billing/             # Plan cards, upgrade buttons
    calculators/         # Calculator forms & results
    copilot/             # Copilot chat interface
    monteCarlo/          # Distribution charts
    notifications/       # Bell dropdown, digest preview
    ui/                  # shadcn/ui base components
  lib/
    auth.config.ts       # NextAuth edge-safe config (no Prisma)
    validations/         # Zod schema validators
  server/
    ai/                  # LLM integrations (OpenAI, Anthropic)
    billing/             # Stripe integration
    calculators/         # Phase 4 calculator engines
    collaboration/       # Multi-user features
    conversation/        # AI copilot logic
    health/              # Health score engine
    healthcare/          # Phase 10 healthcare cost modeling
    housing/             # Phase 11 housing decisions
    jobs/                # Background job runners
    logging/             # Structured logging
    monteCarlo/          # Phase 6 probabilistic engine
    notifications/       # In-app & email notifications
    observability/       # Metrics, tracing
    reports/             # Report generation & export
    scenarios/           # Scenario management
    security/            # Rate limiting, auth guards
    services/            # Shared utilities
    simulation/          # Core deterministic projection engine
    socialSecurity/      # Social Security optimization
    tax/                 # Tax planning & Roth conversions
    withdrawalStrategies/ # Phase 7 withdrawal policy & ordering
  services/              # Client-facing service layer
  types/                 # Global TypeScript types
  __tests__/             # Vitest unit tests
  middleware.ts          # Auth, security headers, request logging
prisma/
  schema.prisma          # 30 models, full household data model
  seed.ts                # Demo data seed
  migrations/            # 15 migration files (Phases 0–18)
docs/
  test-script.md         # 25-section manual test guide
  phase3.md              # Phase 3 architecture notes
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
| 8 | Social Security optimization (break-even, survivor, claiming strategies) |
| 9 | Tax planning + Roth conversion analysis |
| 10 | Healthcare cost modeling + longevity stress testing |
| 11 | Housing decisions: downsizing, relocation, equity release, legacy planning |
| 12 | Reports & CSV export |
| 13 | AI insights + copilot chat (OpenAI / Anthropic) |
| 14 | Conversation session history |
| 15 | Multi-user collaboration (invitations, role-based access, audit log) |
| 17 | Stripe subscription billing (FREE / PRO / ADVISOR) |
| 18 | In-app notifications + email digest + plan health score |

---

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

---

## Phase 8 — Social Security Optimization

- Break-even age analysis for all claiming ages (62–70)
- Spousal benefit comparison
- Survivor benefit projections
- Claiming strategy comparison (early vs. delayed vs. coordinated)

### Routes

| Route | Description |
|-------|-------------|
| `/app/social-security` | List optimization runs |
| `/app/social-security/new` | Run new analysis |
| `/app/social-security/[runId]` | Results with break-even analysis |
| `/app/social-security/compare` | Compare claiming strategies |
| `/app/survivor-income` | Survivor benefit projections |

---

## Phase 9 — Tax Planning + Roth Conversions

- Multi-year tax projection with bracket analysis
- Roth conversion opportunity identification
- Required Minimum Distribution (RMD) planning
- Tax-efficient withdrawal sequencing

### Routes

| Route | Description |
|-------|-------------|
| `/app/tax-planning` | List tax analyses |
| `/app/tax-planning/new` | Create analysis |
| `/app/tax-planning/[runId]` | Results with Roth conversion options |
| `/app/tax-planning/compare` | Compare strategies |
| `/app/roth-conversions` | Roth conversion analysis |

---

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

---

## Phase 11 — Housing Decisions + Downsizing + Relocation + Legacy Planning

### What's included

- **Stay-in-place baseline**: Models current housing cost with annual inflation and property value appreciation.
- **Downsizing**: Models home sale with selling costs, mortgage payoff, optional replacement home, and move costs. Net released equity enters the investable asset pool.
- **Relocation**: Models move to a new state/area with different housing cost profile. Provides state-tax awareness note.
- **Equity release**: Net sale proceeds enter the balance sheet explicitly — affects withdrawals, depletion timing, and legacy.
- **Legacy/estate projection**: End-of-plan financial assets + real-estate equity - liabilities = projected net estate.
- **Gifting**: Optional annual or one-time gifting reduces estate and investable assets.
- **Comparison**: A/B comparison of housing runs with config diffs, outcome diffs, and year-by-year housing cost delta.

### Services

| Service | Responsibility |
|---|---|
| `housingAssumptionService` | Load/validate effective housing assumptions |
| `downsizingService` | Downsize event: net proceeds, replacement home |
| `relocationService` | Relocation: cost change, state-tax note |
| `equityReleaseService` | Balance-sheet integration of equity proceeds |
| `housingPlanningService` | Main orchestration |
| `legacyProjectionService` | End-of-plan estate estimation |
| `housingComparisonService` | A/B run comparison |

### Key limitations (v1)

- Planning-grade approximations; not real-estate transaction software
- Not legal estate-planning software; no trust, probate, or estate-tax modeling
- Annual time-step model; no monthly payment detail
- Simplified mortgage amortization (planning approximation)
- No reverse mortgage modeling
- No gift-tax law modeling
- No actuarial mortality for exact survivor transitions
- No AI interpretation yet

### UI pages

| Route | Description |
|---|---|
| `/app/housing-planning` | Index: prior runs + create new |
| `/app/housing-planning/new` | Create new analysis |
| `/app/housing-planning/[runId]` | Run detail with year-by-year table |
| `/app/housing-planning/compare` | A/B comparison |
| `/app/downsizing` | Downsizing educational content + runs |
| `/app/legacy-planning` | Legacy/estate projection + runs |

---

## Phase 13 — AI Insights + Copilot Chat

- Per-run AI interpretation for all analysis types (simulations, Monte Carlo, withdrawal, Social Security, tax, healthcare, housing)
- Persistent copilot chat with session history
- Configurable AI provider (OpenAI or Anthropic) and model via env vars
- LLM insight caching (`AiInsightCache`) to avoid redundant API calls

### Routes

| Route | Description |
|---|---|
| `/app/ai-insights` | AI insight hub |
| `/app/ai-insights/[runType]/[runId]` | Insight for a specific analysis run |
| `/app/copilot` | Persistent AI chat copilot |

---

## Phase 15 — Multi-User Collaboration

- Invite advisors or family members to a household via email token
- Role-based membership (owner, editor, viewer)
- Collaboration audit log (all actions timestamped per user)
- Accept invitation flow at `/invite/[token]`

### Routes

| Route | Description |
|---|---|
| `/app/settings/access` | Manage members and send invitations |
| `/invite/[token]` | Accept an invitation |

---

## Phase 17 — Stripe Subscription Billing

Three subscription tiers: **FREE**, **PRO**, **ADVISOR**

- Stripe Checkout for new subscriptions
- Stripe Customer Portal for plan changes and cancellations
- Webhook handler for subscription lifecycle events
- Usage metrics tracking

### Routes

| Route | Description |
|---|---|
| `/app/settings/billing` | Subscription management |

---

## Phase 18 — Notifications + Plan Health Score

### Notifications

- In-app notification bell with unread count
- Mark as read / mark all as read
- Per-user notification preferences
- Email digest (via Resend) — preview available before sending
- Background alert job (secured by `NOTIFICATION_JOB_SECRET`)

### Plan Health Score

Composite 0–100 score across 7 components:

| Component | Description |
|---|---|
| Portfolio Sufficiency | Projected balance vs. spending needs |
| Income Replacement | Income sources vs. pre-retirement income |
| Debt Load | Liability-to-asset ratio |
| Healthcare Preparedness | Healthcare funding adequacy |
| Longevity Coverage | Plan coverage to life expectancy |
| Emergency Buffer | Liquid reserve adequacy |
| Profile Completeness | Data completeness across all modules |

Score tiers: **EXCELLENT** (90+) · **GOOD** (75–89) · **FAIR** (60–74) · **AT_RISK** (40–59) · **CRITICAL** (<40)

### Routes

| Route | Description |
|---|---|
| `/app/settings/notifications` | Notification preferences |
| `/app/plan-health` | Plan health dashboard |
| `/app/overview` | Dashboard with health score summary |
