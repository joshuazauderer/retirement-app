# RetirePlan — Manual Test Script
**App URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io`
**Test Household:** The Martinez Family (married couple, Texas, near retirement)
**Date of Test:** _(fill in)_
**Tester:** _(fill in)_

---

## How to Use This Script

- Work through sections **in order** — later tests depend on data entered earlier.
- Each section has **What to Enter** and **What You Should See** (the pass criteria).
- Mark each test ✅ Pass / ❌ Fail / ⚠️ Partial as you go.
- Sections marked **[PRO PLAN REQUIRED]** will return a 402 upgrade prompt on a FREE account. To test them fully, either set `STRIPE_SECRET_KEY` to a Stripe test key and upgrade, or temporarily add the user to PRO directly in the database.
- **Expected numbers** are ranges — the engine is deterministic so results will match exactly on the same data, but small differences in how you enter amounts are fine.

---

## Section 1 — Account Creation & Onboarding

### 1.1 Sign Up

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/signup`

**What to Enter:**
| Field | Value |
|---|---|
| Name | `Carlos Martinez` |
| Email | `carlos.martinez@example.com` |
| Password | `Test1234!` |

**What You Should See:**
- Redirected to `/onboarding` (5-step wizard)
- Page title: "Your Info" with progress bar at step 1 of 5

---

### 1.2 Onboarding — Step 1: Your Info

**What to Enter:**
| Field | Value |
|---|---|
| First Name | `Carlos` |
| Last Name | `Martinez` |
| Date of Birth | `1969-03-15` |

Click **Next**.

**What You Should See:**
- Advance to Step 2: "Household Type"
- No validation errors

---

### 1.3 Onboarding — Step 2: Household Type

Select **Couple (planning for two people)**.

Click **Next**.

---

### 1.4 Onboarding — Step 3: Spouse

**What to Enter:**
| Field | Value |
|---|---|
| First Name | `Elena` |
| Last Name | `Martinez` |
| Date of Birth | `1971-07-22` |

Click **Next**.

---

### 1.5 Onboarding — Step 4: Location & Taxes

**What to Enter:**
| Field | Value |
|---|---|
| State of Residence | `TX` |
| Filing Status | `Married Filing Jointly` |

Click **Next**.

---

### 1.6 Onboarding — Step 5: Retirement Goals

**What to Enter:**
| Field | Value |
|---|---|
| Carlos's Retirement Target Age | `65` |
| Carlos's Life Expectancy | `90` |
| Elena's Retirement Target Age | `63` |
| Elena's Life Expectancy | `90` |

Click **Finish** (or **Complete Setup**).

**What You Should See:**
- Redirected to `/app/overview`
- Household name displayed (e.g., "Martinez Household")
- Overview cards showing zeroes or "no data yet" states
- Plan health score ring present (likely 0–20% at this stage — no data yet)
- Navigation bar visible with all section links

---

## Section 2 — Financial Profile: Income

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/income`

Add **two** income sources via "+ Add Income".

### 2.1 Carlos's Salary

**What to Enter:**
| Field | Value |
|---|---|
| Member | `Carlos Martinez` |
| Type | `SALARY` |
| Label | `Software Engineer — Acme Corp` |
| Amount | `145000` |
| Frequency | `ANNUALLY` |
| Taxable | ✓ (checked) |
| Is Active | ✓ (checked) |

Click **Save**.

### 2.2 Elena's Salary

**What to Enter:**
| Field | Value |
|---|---|
| Member | `Elena Martinez` |
| Type | `SALARY` |
| Label | `Registered Nurse — General Hospital` |
| Amount | `85000` |
| Frequency | `ANNUALLY` |
| Taxable | ✓ (checked) |
| Is Active | ✓ (checked) |

Click **Save**.

**What You Should See:**
- Income list shows 2 sources
- Total annual income displayed: **$230,000**
- Both show the correct member name

---

## Section 3 — Financial Profile: Assets

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/assets`

Add **6** accounts via "+ Add Account".

### 3.1 Carlos's 401(k)

| Field | Value |
|---|---|
| Member | `Carlos Martinez` |
| Owner Type | `INDIVIDUAL` |
| Type | `TRADITIONAL_401K` |
| Account Name | `Carlos 401(k) — Acme Fidelity` |
| Current Balance | `680000` |
| Tax Treatment | `TAX_DEFERRED` |
| Expected Return Rate | `0.07` |

### 3.2 Elena's 401(k)

| Field | Value |
|---|---|
| Member | `Elena Martinez` |
| Owner Type | `INDIVIDUAL` |
| Type | `TRADITIONAL_401K` |
| Account Name | `Elena 401(k) — Hospital TIAA` |
| Current Balance | `210000` |
| Tax Treatment | `TAX_DEFERRED` |
| Expected Return Rate | `0.07` |

### 3.3 Joint Brokerage

| Field | Value |
|---|---|
| Member | _(leave blank or select either)_ |
| Owner Type | `JOINT` |
| Type | `BROKERAGE` |
| Account Name | `Martinez Joint Brokerage — Vanguard` |
| Current Balance | `125000` |
| Tax Treatment | `TAXABLE` |
| Expected Return Rate | `0.07` |

### 3.4 Carlos's Roth IRA

| Field | Value |
|---|---|
| Member | `Carlos Martinez` |
| Owner Type | `INDIVIDUAL` |
| Type | `ROTH_IRA` |
| Account Name | `Carlos Roth IRA — Vanguard` |
| Current Balance | `45000` |
| Tax Treatment | `TAX_FREE` |
| Expected Return Rate | `0.07` |

### 3.5 Elena's Roth IRA

| Field | Value |
|---|---|
| Member | `Elena Martinez` |
| Owner Type | `INDIVIDUAL` |
| Type | `ROTH_IRA` |
| Account Name | `Elena Roth IRA — Fidelity` |
| Current Balance | `38000` |
| Tax Treatment | `TAX_FREE` |
| Expected Return Rate | `0.07` |

### 3.6 Joint Savings (Emergency Fund)

| Field | Value |
|---|---|
| Member | _(leave blank)_ |
| Owner Type | `JOINT` |
| Type | `SAVINGS` |
| Account Name | `Martinez Emergency Fund — Chase` |
| Current Balance | `85000` |
| Tax Treatment | `TAXABLE` |
| Expected Return Rate | `0.03` |

**What You Should See:**
- 6 accounts listed
- **Total Portfolio Balance: $1,183,000** (sum of all balances)
- Breakdown by tax treatment:
  - Tax-Deferred: $890,000 (Carlos 401k + Elena 401k)
  - Taxable: $210,000 (brokerage + savings)
  - Tax-Free: $83,000 (Roth IRA × 2)

---

## Section 4 — Financial Profile: Liabilities

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/liabilities`

Add **1** liability via "+ Add Liability".

### 4.1 Home Mortgage

| Field | Value |
|---|---|
| Member | _(leave blank — joint)_ |
| Type | `MORTGAGE` |
| Label | `Primary Home Mortgage — Wells Fargo` |
| Balance | `280000` |
| Monthly Payment | `2100` |
| Interest Rate | `0.035` _(3.5%)_ |
| Is Active | ✓ |

Click **Save**.

**What You Should See:**
- 1 liability listed
- Total liabilities: **$280,000**
- Monthly payment: **$2,100**

---

## Section 5 — Financial Profile: Expenses

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/expenses`

Fill in the **single expense profile form** and click **Save**.

| Field | Value |
|---|---|
| Current Monthly Spending | `7500` |
| Retirement Monthly Essential | `5500` |
| Retirement Monthly Discretionary | `2000` |
| Healthcare Monthly Estimate | `800` |
| Housing Monthly Estimate | `2100` _(mortgage payment)_ |
| Travel Monthly Estimate | `500` |
| Other Monthly Estimate | `300` |
| Inflation Assumption | `0.03` |
| Notes | `Includes mortgage, utilities, groceries, and healthcare. Travel budget increases in early retirement.` |

**What You Should See:**
- "Saved successfully" confirmation
- Current monthly spending: **$7,500** / **$90,000 annually**
- Retirement monthly total: **$7,500** ($5,500 + $2,000)

---

## Section 6 — Financial Profile: Benefits (Social Security)

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/benefits`

Add **2** benefit sources via "+ Add Benefit".

### 6.1 Carlos's Social Security

| Field | Value |
|---|---|
| Member | `Carlos Martinez` |
| Type | `SOCIAL_SECURITY` |
| Label | `Carlos Social Security` |
| Estimated Monthly Benefit | `2800` |
| Claim Age | `67` |
| Is Active | ✓ |

### 6.2 Elena's Social Security

| Field | Value |
|---|---|
| Member | `Elena Martinez` |
| Type | `SOCIAL_SECURITY` |
| Label | `Elena Social Security` |
| Estimated Monthly Benefit | `1600` |
| Claim Age | `67` |
| Is Active | ✓ |

**What You Should See:**
- 2 benefit sources listed
- Carlos: $2,800/mo at age 67 → lifetime benefit label visible
- Elena: $1,600/mo at age 67

---

## Section 7 — Financial Profile: Housing (Real Estate)

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/housing`

Add **1** property via "+ Add Property".

| Field | Value |
|---|---|
| Type | `PRIMARY_RESIDENCE` |
| Label | `Martinez Family Home — Austin, TX` |
| Ownership Type | `JOINT` |
| Current Market Value | `650000` |
| Mortgage Balance | `280000` |
| Monthly Mortgage Payment | `2100` |
| Annual Property Tax | `8500` |
| Is Primary Residence | ✓ |
| Downsizing Candidate | ✓ |

**What You Should See:**
- 1 property listed
- Market value: **$650,000**
- Equity: **$370,000** (value minus mortgage)

---

## Section 8 — Financial Profile: Planning Assumptions

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/assumptions`

Fill in the assumptions form and click **Save**.

| Field | Value |
|---|---|
| Inflation Rate | `0.03` _(3%)_ |
| Expected Portfolio Return | `0.07` _(7%)_ |
| Expected Portfolio Volatility | `0.12` _(12% — for Monte Carlo)_ |
| Assumed Tax Rate | `0.22` _(22%)_ |
| Simulation Count Default | `1000` |

**What You Should See:**
- "Saved successfully" confirmation

---

## Section 9 — Overview Dashboard Check

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

At this point the financial profile is complete but no simulations have been run yet.

**What You Should See:**
- **Total Portfolio:** $1,183,000
- **Annual Income:** $230,000
- **Annual Expenses:** $90,000
- **Net Worth (approx):** ~$1,923,000 ($1,183,000 portfolio + $650,000 home − $280,000 mortgage)
- **Plan Health Score:** somewhere in the 30–55% range (profile is complete but no simulation data yet; exact score depends on completeness weighting)
- Profile Completion: should show **100%** (or near it — all core sections filled)

---

## Section 10 — Deterministic Simulation

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/simulations`

### 10.1 Validate Inputs

Before running, check the validation banner at the top of the page.

**What You Should See:**
- **Validation: PASS** — no blocking errors
- Possibly warnings like "No annual contribution amounts configured" (minor — contributions are implicit from income)

### 10.2 Run Simulation

Click **"Run Projection"**.

**What You Should See (within 2–5 seconds):**
- Redirected to `/app/simulations/[runId]` (the run detail page)
- A new URL like `/app/simulations/clxxxxxxxxxxxxx`
- **Note the `runId` from the URL** — you will need it for later tests

**Summary Cards — Expected Values:**

| Card | Expected Range | Pass Criteria |
|---|---|---|
| **Projection Status** | ✅ Success | `success: true` shown |
| **Portfolio Depletion** | — (no depletion) | Should say "No depletion" or "—" |
| **Ending Portfolio Balance** | $500,000 – $4,000,000 | Any positive number |
| **Ending Net Worth** | $600,000 – $4,500,000 | Greater than ending portfolio |
| **Projection End Year** | 2061 | Carlos born 1969 + 90 years - 1 = 2058; Elena born 1971 + 90 = 2061 |
| **Years Projected** | 35 | From 2026 to 2061 |
| **Total Withdrawals** | $1,500,000 – $4,000,000 | Large positive number (35 years of draws) |
| **Total Taxes** | $300,000 – $1,200,000 | Positive |

**Year-by-Year Table — Spot Checks:**

| Year | What to Check |
|---|---|
| **2026** (Year 1) | Income ≈ $230,000; Expenses ≈ $90,000; positive balance |
| **2034** (Carlos retires at 65) | Earned income drops to zero; benefit income begins for Elena (SS at 63 → 2034) |
| **2036** (Carlos claims SS at 67) | Benefit income jumps by ~$2,800/month = $33,600/year |
| **2038** (Elena claims SS at 67) | Benefit income increases further by ~$1,600/month |
| **2061** (Final year) | Last row in table; balance should still be ≥ $0 |

> 💡 **Tip:** Click any year row to expand it and see the full income/expense/withdrawal breakdown for that year.

---

## Section 11 — Scenarios

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/scenarios`

### 11.1 Confirm Baseline Scenario Exists

**What You Should See:**
- One scenario already created automatically during simulation, labelled **"Baseline"** with `isBaseline: true`
- Note the **Scenario ID** shown in the URL when you click into it — you will need this for Tax Planning, Monte Carlo, etc.

### 11.2 Create an Alternative Scenario

Click **"+ New Scenario"**.

| Field | Value |
|---|---|
| Name | `Early Retirement — Age 62` |
| Description | `Carlos retires at 62 instead of 65. Tests impact of 3 fewer working years.` |
| Is Baseline | ☐ (unchecked) |

Click **Save**.

**What You Should See:**
- 2 scenarios listed
- Baseline and "Early Retirement — Age 62"

---

## Section 12 — Social Security Optimization

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/social-security`
Click **"+ New Analysis"**.

### 12.1 Run Analysis — Claim at FRA (67)

| Field | Value |
|---|---|
| Scenario | Select **Baseline** |
| Label | `Claim at Full Retirement Age (67)` |
| Carlos Claim Age | `67` |
| Elena Claim Age | `67` |
| Survivor Expense Ratio | `80` _(80% — survivor needs 80% of couple spending)_ |

Click **Run Analysis**.

**What You Should See (result page):**

| Metric | Expected Range | Pass |
|---|---|---|
| Carlos lifetime SS benefit | $700,000 – $1,200,000 | Any large positive |
| Elena lifetime SS benefit | $400,000 – $700,000 | Any large positive |
| Combined lifetime benefit | $1,100,000 – $1,900,000 | Sum of both |
| Annual benefit at FRA (Carlos) | ~$33,600 ($2,800 × 12) | ±$500 |
| Annual benefit at FRA (Elena) | ~$19,200 ($1,600 × 12) | ±$500 |

### 12.2 Run Analysis — Delayed Claim (70)

Go back to `/app/social-security`, click **"+ New Analysis"**.

| Field | Value |
|---|---|
| Scenario | Select **Baseline** |
| Label | `Delayed Claim — Age 70` |
| Carlos Claim Age | `70` |
| Elena Claim Age | `70` |
| Survivor Expense Ratio | `80` |

**What You Should See:**
- Carlos's monthly benefit at 70 is higher than at 67 (approximately **$3,472/month** — 24% increase for 3 years of delay at ~8%/year)
- Combined lifetime benefit is typically higher for delayed claiming assuming longevity to 90
- A **comparison table** or note showing the break-even age (typically ~82–83 years old)

### 12.3 Compare Analyses

On the Social Security list page, select both runs and click **Compare**.

**What You Should See:**
- Side-by-side table with both strategies
- Delayed claim shows higher per-year income but lower cumulative benefit in early years
- Break-even crossover year visible in the chart

---

## Section 13 — Monte Carlo Simulation [PRO PLAN REQUIRED]

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/monte-carlo`

> ⚠️ If on FREE plan: you will see a **402 Upgrade Required** prompt. Skip to Section 14.

Click **"+ New Simulation"** (`/app/monte-carlo/new`).

| Field | Value |
|---|---|
| Scenario | Select **Baseline** |
| Simulation Count | `1000` |
| Volatility Override | _(leave blank — use planning assumptions value of 12%)_ |
| Randomize Seed | ✓ (checked) |

Click **Run Simulation** (takes 3–10 seconds for 1,000 runs).

**What You Should See (result page):**

| Metric | Expected Range | Pass Criteria |
|---|---|---|
| **Success Probability** | **80% – 95%** | Positive, realistic percentage |
| **Failure Probability** | 5% – 20% | = 100% − success rate |
| **Median Ending Assets** | $500,000 – $3,000,000 | Positive |
| **P10 Ending Assets** | > $0 (just barely) | Should be positive or very small negative |
| **P90 Ending Assets** | $2,000,000 – $6,000,000 | Significantly higher than median |
| **Median Depletion Year** | `null` or 2055+ | No depletion in median scenario |
| **Simulation Count** | 1,000 | Exact |

**Chart Check:**
- Distribution chart visible showing spread of outcomes
- Green (success) portion should be majority of the bars

> 💡 **Why these ranges?** The Martinez household starts with $1.18M, retires with an estimated $2.5–3M (8 years of 7% returns + contributions), then draws ~$90K/year inflated, offset by ~$52K/year SS income. A 4% withdrawal rate on $2.5M = $100K — very comfortable. 80–95% success rate is expected.

---

## Section 14 — Tax Planning / Roth Conversions

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/tax-planning`

Click **"+ New Analysis"** (`/app/tax-planning/new`).

### 14.1 Run Baseline Tax Analysis (No Roth)

| Field | Value |
|---|---|
| Scenario | Select **Baseline** |
| Label | `Standard Tax — TAXABLE_FIRST ordering` |
| Withdrawal Ordering | `TAXABLE_FIRST` |
| Capital Gains Basis Ratio | `60` _(60% cost basis)_ |
| Enable Roth Conversion | ☐ (unchecked) |

Click **Run Analysis**.

**What You Should See:**

| Metric | Expected Range |
|---|---|
| Total Tax Liability (lifetime) | $300,000 – $1,000,000 |
| First year tax (2026) | ~$43,000 – $55,000 (22% effective on $230K income minus deductions) |
| Tax-deferred withdrawals start | In or after 2034 (retirement year) |

### 14.2 Run Roth Conversion Analysis

Go back, click **"+ New Analysis"**.

| Field | Value |
|---|---|
| Scenario | Select **Baseline** |
| Label | `Roth Conversion — $25K/year 2026–2031` |
| Withdrawal Ordering | `TAXABLE_FIRST` |
| Capital Gains Basis Ratio | `60` |
| Enable Roth Conversion | ✓ |
| Annual Conversion Amount | `25000` |
| Start Year | `2026` |
| End Year | `2031` |

Click **Run Analysis**.

**What You Should See:**
- Higher taxes in 2026–2031 (conversion years) — approximately $5,500–$6,500 more per year
- Lower taxes in retirement years (less tax-deferred balance to draw from)
- Summary should note the Roth conversion strategy

### 14.3 Compare Both Runs

On the Tax Planning list page, select both runs and click **Compare**.

**What You Should See:**
- Side-by-side comparison of total lifetime tax burden
- Roth conversion run typically shows lower lifetime taxes if you live to 90
- Year-by-year tax comparison table

---

## Section 15 — Healthcare Planning [PRO PLAN REQUIRED]

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/healthcare-planning`

> ⚠️ If on FREE plan, skip to Section 16.

Click **"+ New Healthcare Plan"** (`/app/healthcare-planning/new`).

### 15.1 Run Standard Healthcare Projection

| Field | Value |
|---|---|
| Scenario | Select **Baseline** |
| Label | `Standard Healthcare — With LTC Stress` |
| **Pre-Medicare** | |
| Annual Premium | `12000` _(employer partially subsidised)_ |
| Annual Out-of-Pocket | `3000` |
| **Medicare** | |
| Medicare Eligibility Age | `65` |
| Include Part B | ✓ |
| Include Part D | ✓ |
| Include Medigap | ✓ |
| Medicare Annual OOP | `1200` |
| **Healthcare Inflation** | `5` _(5% per year)_ |
| **LTC Stress** | ✓ Enabled |
| LTC Start Age | `82` |
| LTC Duration | `3` years |
| LTC Annual Cost | `90000` |
| **Longevity Stress** | ☐ Disabled |
| Include Spouse | ✓ (include Elena) |

Click **Run Healthcare Plan**.

**What You Should See:**

| Metric | Expected Range |
|---|---|
| Total Healthcare Cost (lifetime) | $800,000 – $2,500,000 |
| Pre-Medicare phase cost (2026–2034) | $100,000 – $200,000 (8 years × ~$15K inflating) |
| Medicare phase begins | 2034 (Carlos at 65) |
| LTC spike visible in year-by-year table | Years around 2051–2053 (Carlos age 82–84) show $90K LTC cost added |
| Has LTC Stress | `true` |
| Has Longevity Stress | `false` |

---

## Section 16 — Housing Planning [PRO PLAN REQUIRED]

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/housing-planning`

> ⚠️ If on FREE plan, skip to Section 17.

Click **"+ New Housing Plan"** (`/app/housing-planning/new`).

### 16.1 Run Downsizing Scenario

| Field | Value |
|---|---|
| Scenario | Select **Baseline** |
| Label | `Downsize at Retirement — 2034` |
| Strategy | `downsize` |
| **Current Property** | |
| Current Value | `650000` |
| Mortgage Balance | `280000` |
| Annual Housing Cost | `24000` _(incl. property tax + maintenance)_ |
| Annual Mortgage Payment | `25200` ($2,100 × 12) |
| Appreciation Rate | `3` _(3% per year)_ |
| **Downsizing Event** | |
| Event Year | `2034` |
| Sale Price at Event | `780000` _(~3% growth × 8 years ≈ $650K × 1.267)_ |
| Selling Costs | `6` _(6% realtor + closing)_ |
| Mortgage Payoff | `220000` _(remaining balance by 2034)_ |
| Buy Replacement Home | ✓ |
| Replacement Cost | `400000` |
| Replacement Mortgage | `0` _(pay cash with equity)_ |
| Post-Move Annual Cost | `16000` _(lower maintenance on smaller home)_ |
| Move Cost | `15000` |
| **Gifting** | ☐ Disabled |
| Include Legacy | ✓ |
| Inflation Rate | `2.5` |

Click **Run Housing Plan**.

**What You Should See:**

| Metric | Expected Range |
|---|---|
| Net Equity Released | $100,000 – $200,000 _(proceeds minus payoff minus replacement)_ |
| Projected Net Estate | $800,000 – $3,000,000 |
| Strategy | `DOWNSIZE` |
| Success | `true` |

**Equity Release Calculation to Verify:**
`Net proceeds = $780,000 × (1 - 0.06) - $220,000 - $400,000 = $733,200 - $220,000 - $400,000 = $113,200`
→ Net equity released should be approximately **$113,000 – $120,000**

---

## Section 17 — Reports & CSV Export [PRO PLAN REQUIRED]

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/reports`

> ⚠️ If on FREE plan, skip to Section 18.

### 17.1 Generate Household Summary Report

Click **"+ New Report"**, select **Household Financial Summary**.

| Field | Value |
|---|---|
| Report Type | `Household Financial Summary` |

Click **Generate**.

**What You Should See:**
- Report page loads at `/app/reports/household_summary/[runId]`
- Summary cards show: Total Portfolio, Annual Income, Annual Expenses, Net Worth
- All values match what you entered in Sections 2–8
- **Print button** visible in top-right
- No `$NaN` or `undefined` values anywhere

### 17.2 Generate Projection Report

From `/app/reports`, create a **Retirement Projection** report linked to your simulation run.

**What You Should See:**
- Year-by-year table
- Depletion status: "No depletion projected"
- Summary card matching simulation results

### 17.3 Download CSV

On any report that has the **Download CSV** button:

Click **Download CSV**.

**What You Should See:**
- Browser download triggers immediately
- File name: `retireplan-[report-type]-[date].csv` (or similar)
- File opens in Excel/Numbers and contains correct column headers and data rows
- No empty rows at the top; first row is column headers

### 17.4 Print Preview

On any report page, click **Print / Save as PDF**.

**What You Should See:**
- Browser print dialog opens
- Navigation bar, buttons, and footer **do not appear** in print preview (hidden via `@media print` CSS)
- Report content fills the full page cleanly
- Page breaks between sections (if multi-page)

---

## Section 18 — AI Insights [PRO PLAN REQUIRED]

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/ai-insights`

> ⚠️ If on FREE plan or no `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` set: you will see either a 402 upgrade prompt or a fallback "AI unavailable" message. Skip to Section 19 if blocked.

### 18.1 Request Simulation Insight

Navigate to your simulation run: `/app/simulations/[your-runId]`

If an **AI Insights panel** or **"Get AI Analysis"** button is visible, click it.

**What You Should See:**
- Insight panel loads (may take 2–10 seconds)
- Contains: **Summary**, **Key Insights** (bullet list), **Risks**, **Recommendations**, **Confidence Notes**
- **Language check:** The AI should NOT make specific investment recommendations, should NOT give tax or legal advice, and should include hedging language like "based on your current data" or "consult a financial advisor"
- The insight should reference actual numbers from the simulation (e.g., portfolio value, depletion status)
- If AI provider is not configured, a **fallback insight** displays (deterministic, safe text) — this is still a pass ✅

### 18.2 Check Risk Badge

On the insight panel:

**What You Should See:**
- A **Risk Badge** showing LOW, MEDIUM, HIGH, or CRITICAL
- Given the Martinez data (healthy portfolio, no depletion), expected risk level: **LOW or MEDIUM**
- Badge colour: green (LOW), yellow (MEDIUM), orange (HIGH), red (CRITICAL)

---

## Section 19 — AI Copilot Chat [PRO PLAN REQUIRED]

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/copilot`

> ⚠️ If on FREE plan, skip to Section 20.

A floating **chat drawer button** should also be visible on every page (bottom-right corner). Click it to open the drawer anywhere.

### 19.1 Ask a Concept Question (Deterministic — No AI needed)

Type: `What is sequence of returns risk?`

**What You Should See:**
- Instant response (no API call needed — this is a deterministic concept lookup)
- Clear explanation of sequence of returns risk in plain English
- Response appears in < 1 second
- No spinner

### 19.2 Ask About Your Plan

Type: `How much will my portfolio be worth when I retire?`

**What You Should See:**
- Response references your **actual simulation data** (not made-up numbers)
- Cites current portfolio ~$1.18M and projected retirement portfolio
- Includes a caveat ("based on current projections" or similar)

### 19.3 Ask a Risk Question

Type: `What are the biggest risks to my retirement plan?`

**What You Should See:**
- Lists specific risks (e.g., sequence risk, healthcare costs, longevity risk)
- References your actual data where possible
- Recommends viewing Monte Carlo or Healthcare sections

### 19.4 Follow-up Suggestions

After any response:

**What You Should See:**
- 2–4 **follow-up suggestion buttons** appear below the response
- Clicking a suggestion auto-populates the chat input

---

## Section 20 — Notifications

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/settings/notifications`

### 20.1 Check Default Preferences

**What You Should See:**
- Page loads with default preferences:
  - Email Digest: **ON**
  - Digest Frequency: **Weekly**
  - Plan Risk Alerts: **ON**
  - Collaboration Alerts: **ON**
  - Billing Alerts: **ON**
  - Simulation Alerts: **OFF**

### 20.2 Change Digest Frequency

Click **Monthly**.

**What You Should See:**
- Button turns blue/selected immediately (optimistic update)
- "Saving…" then "✓ Preferences saved" confirmation within 1–2 seconds

### 20.3 Disable Simulation Alerts

Toggle **"Simulation completion"** to OFF.

**What You Should See:**
- Toggle flips to grey
- "✓ Preferences saved" appears

### 20.4 Load Digest Preview

Click **"Preview Digest"**.

**What You Should See:**
- After 1–3 seconds, a digest preview renders below
- Shows **Plan Health** summary (green banner) citing Monte Carlo success rate or simulation status
- Shows **Housing & Legacy** section if housing plan exists
- Shows **Tax Planning** section if tax run exists
- Shows **Healthcare Planning** section if healthcare run exists
- No raw JSON or `undefined` text visible

> If no simulation data exists yet, a message "Not enough planning data" appears — that is expected ✅

### 20.5 Notification Bell

Click the **bell icon** in the navigation bar (top right).

**What You Should See:**
- A dropdown panel opens
- Initially shows "No notifications yet 🔔" (no alerts have been triggered yet)
- A "Manage notification preferences →" link at the bottom
- Clicking the link navigates to `/app/settings/notifications`

### 20.6 Trigger a Manual Alert Check (Optional — Requires Job Secret or Admin)

Make a POST request to `/api/notifications/jobs`:

```bash
curl -X POST http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/api/notifications/jobs \
  -H "Content-Type: application/json" \
  -d '{"job": "alertCheck"}'
```

_(Requires being logged in via a browser session, or set `NOTIFICATION_JOB_SECRET` in .env and pass it as `x-notification-job-secret` header)_

**What You Should See:**
```json
{ "jobId": "job_XXXXX", "job": "alertCheck", "status": "QUEUED" }
```

Then check the bell — if your Monte Carlo success rate is below 75%, a `PLAN_RISK_HIGH` notification will appear.

---

## Section 21 — Multi-User Collaboration [PRO PLAN REQUIRED]

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/settings/access`

> ⚠️ If on FREE plan, skip to Section 22.

### 21.1 Send an Invitation

**What to Enter:**
| Field | Value |
|---|---|
| Email | `advisor.test@example.com` |
| Role | `COLLABORATOR` |

Click **Send Invitation**.

**What You Should See:**
- Invitation appears in "Pending Invitations" list
- Shows email, role, expiry date (7 days from now)
- A **Revoke** button next to the invitation

### 21.2 View Invitation Link

The invitation token is in the DB. To test the acceptance flow:

1. Open a new **incognito window** and sign up as `advisor.test@example.com`
2. Navigate to `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/invite/[token]` (copy token from pending invitations list if shown, or check the DB: `SELECT token FROM household_invitations WHERE email = 'advisor.test@example.com'`)
3. Click **Accept Invitation**

**What You Should See (in incognito):**
- Page: "You've been invited to join [Household Name]"
- Role and inviter shown
- After clicking **Accept**, redirected to `/app/overview`
- The Martinez household is now accessible to this user

**What You Should See (back in main window at `/app/settings/access`):**
- Invitation moves from "Pending" to the "Members" list
- New member shown with role `COLLABORATOR`

### 21.3 Remove Member

Click **Remove** next to the collaborator.

**What You Should See:**
- Member removed from list immediately
- Collaborator can no longer access the household (session-dependent)

---

## Section 22 — Billing Page

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/settings/billing`

### 22.1 View Current Plan

**What You Should See:**
- Current plan badge: **FREE** (or PRO/ADVISOR if you've upgraded)
- Three plan cards: **Free**, **Pro ($29/mo)**, **Advisor ($99/mo)**
- Pro card highlighted (blue border or "Recommended" badge)
- Feature list for each plan
- Usage summary showing:
  - Scenarios used: 2 of 3 (Free limit)
  - Simulations used: 1 of 5 (Free limit)

### 22.2 Upgrade Button

Click **Upgrade to Pro**.

**What You Should See:**
- If `STRIPE_SECRET_KEY` is a test key: redirected to Stripe Checkout (test mode)
- If Stripe not configured: a `500` or "Stripe not configured" error — this is expected since Stripe keys are placeholder values; real Stripe keys must be set in Coolify to enable billing ✅
- No crash or unhandled exception in the console

---

## Section 23 — Health API Check

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/api/health`

Open in browser or run:
```bash
curl http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/api/health
```

**What You Should See:**
```json
{ "status": "ok" }
```
or
```json
{ "status": "degraded", "db": false }
```

Pass criteria: a valid JSON response (not a 500 error). `"ok"` means database is healthy.

---

## Section 24 — Security Headers Check

Open browser DevTools → Network tab → Click any `/api/` request.

**What You Should See in Response Headers:**

| Header | Expected Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Request-ID` | A UUID (different on each request) |

---

## Section 25 — Rate Limiting Check

Make 6 rapid POST requests to `/api/simulations` (or any endpoint) in quick succession from the same session.

**What You Should See:**
- First 5 requests: normal response
- When the limit is hit: HTTP **429 Too Many Requests**
- Response body:
  ```json
  { "error": "Rate limit exceeded" }
  ```
- Response headers include `X-RateLimit-Remaining: 0` and `X-RateLimit-Reset` (timestamp)

---

---

## Section 26 — Guided Dashboard: Plan Health Hero

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

This tests the new `PlanHealthHeroCard` at the top of the redesigned dashboard. Run this section **after** completing Sections 1–10 so simulation data exists.

### 26.1 Hero Card Present and Dominant

**What You Should See:**
- The **first visible element** below the page title is the Plan Health Hero card
- The card is visually distinct from the rest of the page (coloured background based on tier)
- A **score ring** (SVG circle) displays the numeric health score (e.g., `72`)
- A **status badge** is visible: one of `On Track`, `Needs Attention`, `At Risk`, or `Incomplete`
- A **one-sentence explanation** is present below the badge (e.g., "Your plan is on track but has meaningful gaps…")

### 26.2 Score Is Reasonable

**What You Should See:**
- Score between **40 and 85** for the Martinez household with full data + 1 simulation
- Score is NOT `0` (that would indicate the health score service failed)
- Score is NOT `100` (that would indicate all components are maxed — unlikely at this stage)

### 26.3 Primary CTA Works

Click **"See What To Do Next →"**.

**What You Should See:**
- Page scrolls to or navigates to the `#next-steps` section (the NextActionsPanel)

### 26.4 Secondary CTA Works

Click **"View Full Analysis"**.

**What You Should See:**
- Navigates to `/app/plan-health`
- Plan health detail page loads without error

### 26.5 Incomplete User State

> Test this by creating a second test account with no data entered.

For an account with no financial data:

**What You Should See:**
- Score ring is replaced with a **📋 icon** (no score available)
- Status badge shows: `Incomplete`
- Explanation: "Complete your core plan details to generate your retirement health score."
- CTA still present and functional

---

## Section 27 — Guided Dashboard: Recommended Next Steps

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview#next-steps`

Tests the `NextActionsPanel` — the prioritized action list.

### 27.1 Actions Are Present

**What You Should See:**
- Between **2 and 4** action cards displayed
- Each card has: a **title**, a **one-sentence description**, and a **CTA button**
- The first action is visually marked **"Priority"** (blue badge)

### 27.2 Actions Are Contextual

For the Martinez household (simulation run, no Monte Carlo, FREE plan):

**Expected actions (order may vary):**
- An action referencing running **Monte Carlo** or upgrading to PRO for Monte Carlo access
- An action referencing **Social Security** review (no SS analysis run yet)
- Possibly a health-score-driven action (e.g., healthcare planning)

**What You Should NOT See:**
- "Finish setting up your plan" (core data is complete)
- "Run your first retirement projection" (simulation already run)

### 27.3 CTA Buttons Navigate Correctly

Click at least one CTA button:

**What You Should See:**
- Navigation to the correct destination (e.g., `/app/monte-carlo`, `/app/social-security`, `/app/settings/billing`)
- No 404 or broken link

### 27.4 Upgrade Action for FREE Users

For a FREE-plan account with simulation run and no Monte Carlo:

**What You Should See:**
- An action with category `upgrade` titled something like "See how your plan holds up in any market"
- CTA button: **"Upgrade to Pro →"**
- Links to `/app/settings/billing`

---

## Section 28 — Guided Dashboard: Plan Completion Tracker

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests the `PlanCompletionCard`.

### 28.1 Completion Percentage Is Correct

For the Martinez household (all data entered + 1 simulation):

**What You Should See:**
- Completion percentage between **60% and 80%**
- Progress bar fills proportionally to the percentage
- Progress bar is **green** at ≥80%, **blue** at ≥50%, **amber** below 50%

### 28.2 Checklist Items Are Accurate

**What You Should See:**
- ✅ **Household Setup** — complete (green dot)
- ✅ **Income** — complete
- ✅ **Assets** — complete
- ✅ **Liabilities** — complete
- ✅ **Expenses** — complete
- ✅ **Benefits** — complete
- ✅ **Housing** — complete
- ✅ **Insurance** — complete (or not_started if insurance not set)
- ✅ **Assumptions** — complete
- ⚠️ **Core Projection Run** — complete (simulation run in Section 10)
- ○ **Monte Carlo Analysis** — not started
- ○ **Social Security Reviewed** — not started
- ○ **Tax Planning Reviewed** — may be complete (Section 14)
- ○ **Withdrawal Strategy Reviewed** — not started

### 28.3 Items Are Clickable

Click any incomplete item.

**What You Should See:**
- Navigates to the correct page (e.g., clicking Monte Carlo → `/app/monte-carlo`)

### 28.4 CTA Button Works

Click **"Continue Setup →"** (or "Plan Complete ✓" if 100%).

**What You Should See:**
- Navigates to `/app/income` (first data entry page)

---

## Section 29 — Guided Dashboard: Key Metrics Grid

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests the `DashboardMetricsGrid`.

### 29.1 All Five Metric Cards Present

**What You Should See:**
- Exactly **5 metric cards** in a responsive grid
- Card labels: `Target Retirement Age`, `Years Funded`, `Projected Ending Balance`, `Monte Carlo Success Rate`, `Expected Return Rate`

### 29.2 Values Are Correct

For the Martinez household:

| Metric | Expected Value | Pass Criteria |
|---|---|---|
| Target Retirement Age | `65` | Matches Carlos's retirement target age from onboarding |
| Years Funded | `35 yrs` (approx) | Between 25 and 40 |
| Projected Ending Balance | $500K–$4M | Any positive value, not trillions |
| Monte Carlo Success Rate | `Not run yet` | If no MC run; or 80–95% if MC completed |
| Expected Return Rate | `7.0%` | Matches assumptions (0.07 entered = 7%) |

### 29.3 Unavailable Metrics Show Graceful Fallback

For metrics not yet calculated:

**What You Should See:**
- Text: `Not run yet` or `Not configured` (not `undefined`, not blank, not an error)
- Card uses a lighter, muted style

### 29.4 Cards Are Clickable

Click any metric card.

**What You Should See:**
- Navigates to the relevant detail page (e.g., Projected Ending Balance → `/app/simulations`)

---

## Section 30 — Guided Dashboard: Scenario Snapshot

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests the `ScenarioSnapshotCard`.

### 30.1 Scenarios Are Listed (Post Section 11)

After creating the Baseline and "Early Retirement — Age 62" scenario in Section 11:

**What You Should See:**
- At least **1–2 scenario rows** in the snapshot card
- Baseline scenario marked with a **"Baseline"** badge
- Each row shows a **name** and an **outcome** (e.g., "Ends with $2.1M" or "May run out in 2055")

### 30.2 No Scenarios State

For a fresh account with no scenarios:

**What You Should See:**
- Message: "Create scenarios to see how different choices affect your retirement"
- CTA: **"Create First Scenario →"**
- Links to `/app/scenarios`

### 30.3 Explore Scenarios CTA Works

Click **"Explore Scenarios →"**.

**What You Should See:**
- Navigates to `/app/scenarios`
- Scenario list page loads correctly

---

## Section 31 — Guided Dashboard: Data Freshness

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests the `DataFreshnessCard`.

### 31.1 Data Freshness Is Shown

**What You Should See:**
- Card titled **"Your Financial Data"**
- A status badge showing either:
  - `Updated today` / `Updated X days ago` — if data was recently saved (it was, just now in Sections 2–8)
  - `⚠ Some data may be outdated` — if any section was updated >90 days ago

### 31.2 Per-Section Timestamps Are Shown

**What You Should See:**
- Up to 4 data items listed: Income, Asset Balances, Liabilities, Expenses
- Each shows a relative timestamp: `Today`, `Xd ago`, or `Xmo ago`
- Items entered in Sections 2–8 today show **"Today"** or **"0d ago"**

### 31.3 Update My Data CTA Works

Click **"Update My Data →"**.

**What You Should See:**
- Navigates to `/app/income`

---

## Section 32 — Guided Dashboard: Next Review Card

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests the `NextReviewCard`.

### 32.1 Review Cadence Shown

**What You Should See:**
- Card titled **"Next Plan Review"**
- Review cadence shown based on notification preferences (default: Monthly)
- If simulation was just run today: "Next review: [date ~1 month from now]" and `isOverdue: false`
- If no simulation has ever been run: "⚠ Review overdue"

### 32.2 Review Now CTA Works

Click **"Review Now →"**.

**What You Should See:**
- Navigates to `/app/simulations`

### 32.3 Set Reminder CTA Works

Click **"Set Reminder"**.

**What You Should See:**
- Navigates to `/app/settings/notifications`

---

## Section 33 — Guided Dashboard: AI Insight Summary

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests the `AIInsightSummaryCard`.

### 33.1 Insight Is Present

**What You Should See:**
- Card titled **"Insights About Your Plan"**
- A **headline sentence** describing the plan's current state (e.g., "Your plan is on solid ground with room to improve.")
- An optional **detail sentence** with a specific action or observation
- If an AI insight is cached: a small **"AI"** badge appears in the card header

### 33.2 Fallback Insight Without AI

If no AI insight cache exists (no OpenAI/Anthropic key configured, or no insight has been generated):

**What You Should See:**
- A **deterministic** insight based on the health score tier
- No error message, no spinner stuck loading
- The card renders with appropriate text for the current tier (e.g., GOOD tier → "Your plan is on solid ground with room to improve.")

### 33.3 CTAs Work

Click **"Ask Copilot →"** — navigates to `/app/copilot`.

Click **"View All Insights"** — navigates to `/app/ai-insights`.

---

## Section 34 — Guided Dashboard: Alerts Summary

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests the `AlertsSummaryCard`.

### 34.1 No Alerts State

For a healthy plan with no triggered alerts:

**What You Should See:**
- Card titled **"Alerts"**
- Green check mark: "No active alerts — your plan looks good."

### 34.2 Alerts Shown When Present

If a `PLAN_RISK_HIGH` or `PORTFOLIO_DEPLETION_ALERT` notification exists in the DB:

**What You Should See:**
- Alert cards listed with colour-coded severity (🔴 Critical, 🟠 High, 🟡 Medium)
- Unread count badge (red circle with number) on the card title
- Timestamps shown as relative time ("Today", "2d ago")

### 34.3 View All Alerts CTA Works

Click **"View All Alerts →"** (or "View All →").

**What You Should See:**
- Navigates to `/app/notifications`

---

## Section 35 — Guided Dashboard: Upgrade Value Card

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests the `UpgradeValueCard`.

### 35.1 Visible for FREE Users

For a FREE-plan account:

**What You Should See:**
- Card at the **bottom of the dashboard** (Row 6) with an indigo/purple gradient background
- Headline: **"Unlock deeper planning tools"**
- Body text mentioning Monte Carlo, AI insights, and unlimited scenarios
- Feature badges listing 5 specific features
- CTA button: **"Upgrade to Pro →"**

### 35.2 Hidden for PRO Users

For a PRO or ADVISOR account:

**What You Should See:**
- The upgrade card is **completely absent** from the page — no empty space, no placeholder

### 35.3 CTA Links to Billing

Click **"Upgrade to Pro →"**.

**What You Should See:**
- Navigates to `/app/settings/billing`

---

## Section 36 — Guided Dashboard: Layout and Responsiveness

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

Tests overall dashboard layout quality.

### 36.1 Desktop Layout (≥1280px)

Resize browser to full desktop width.

**What You Should See:**
- Row 1: Plan Health Hero — full width
- Row 2: Next Steps (3/5 width) + Plan Completion (2/5 width) side by side
- Row 3: 5 metric cards in a single row
- Row 4: Scenario, Freshness, Review cards in 3 columns
- Row 5: AI Insights and Alerts in 2 columns
- Row 6: Upgrade card full width (or absent for PRO)

### 36.2 Mobile Layout (≤640px)

Resize browser to 375px width (iPhone size).

**What You Should See:**
- All cards **stack vertically** — no horizontal overflow or cropped content
- Hero card remains readable — score ring and text visible
- Metrics grid collapses to 2 columns
- No horizontal scrollbar

### 36.3 No Blank Cards or Errors

**What You Should See:**
- No section displays raw `undefined`, `NaN`, `null`, or `[object Object]`
- No broken/empty card states (every card has at least a title and some content)
- No JavaScript errors in the browser console (`F12 → Console` tab)

---

## Section 37 — Guided Dashboard: New User / Incomplete State

Create a **fresh test account** with no data entered.

**URL:** `http://acw8co8o0w8c48k444ogsgkw.31.220.51.123.sslip.io/app/overview`

### 37.1 Page Title

**What You Should See:**
- Page title: **"Welcome to RetirePlan"** (not "Your Retirement Plan" — new user variant)

### 37.2 Incomplete Hero

**What You Should See:**
- Status badge: `Incomplete`
- No score ring — replaced with 📋 icon
- Explanation: "Complete your core plan details to generate your retirement health score."

### 37.3 Setup-Focused Actions

**What You Should See:**
- First action: "Finish setting up your plan" with CTA "Continue Setup"
- Second action: "Run your first retirement projection" (once data is added, but not yet)

### 37.4 Completion Shows 0%

**What You Should See:**
- Completion percentage: **0%** (or very low)
- Progress bar is empty or amber
- Most checklist items show grey ○ (not started)

### 37.5 Metrics Show Graceful Fallbacks

**What You Should See:**
- "Target Retirement Age" → "Not set"
- "Years Funded" → "Not calculated"
- "Projected Ending Balance" → "Not calculated"
- "Monte Carlo Success Rate" → "Not run yet"
- "Expected Return Rate" → "Not configured"

### 37.6 Dashboard Never Crashes

**What You Should See:**
- No uncaught exceptions
- No 500 error
- Page fully renders with appropriate empty states for every section

---

## Test Results Summary

| Section | Feature | Result | Notes |
|---|---|---|---|
| 1 | Account Creation & Onboarding | | |
| 2 | Income Entry | | |
| 3 | Asset Entry (6 accounts, $1.183M) | | |
| 4 | Liabilities | | |
| 5 | Expenses | | |
| 6 | Benefits (Social Security) | | |
| 7 | Housing / Real Estate | | |
| 8 | Planning Assumptions | | |
| 9 | Overview Dashboard (legacy check) | | |
| 10 | Deterministic Simulation (no depletion) | | |
| 11 | Scenarios | | |
| 12 | Social Security Optimization | | |
| 13 | Monte Carlo [PRO] | | |
| 14 | Tax Planning / Roth Conversions | | |
| 15 | Healthcare Planning [PRO] | | |
| 16 | Housing Planning / Downsizing [PRO] | | |
| 17 | Reports & CSV Export [PRO] | | |
| 18 | AI Insights [PRO] | | |
| 19 | AI Copilot Chat [PRO] | | |
| 20 | Notifications (Bell + Preferences + Digest Preview) | | |
| 21 | Multi-User Collaboration [PRO] | | |
| 22 | Billing Page | | |
| 23 | Health API | | |
| 24 | Security Headers | | |
| 25 | Rate Limiting | | |
| 26 | Guided Dashboard: Plan Health Hero | | |
| 27 | Guided Dashboard: Recommended Next Steps | | |
| 28 | Guided Dashboard: Plan Completion Tracker | | |
| 29 | Guided Dashboard: Key Metrics Grid | | |
| 30 | Guided Dashboard: Scenario Snapshot | | |
| 31 | Guided Dashboard: Data Freshness | | |
| 32 | Guided Dashboard: Next Review Card | | |
| 33 | Guided Dashboard: AI Insight Summary | | |
| 34 | Guided Dashboard: Alerts Summary | | |
| 35 | Guided Dashboard: Upgrade Value Card | | |
| 36 | Guided Dashboard: Layout & Responsiveness | | |
| 37 | Guided Dashboard: New User / Incomplete State | | |

---

## Appendix A — Test User Reference

| Field | Value |
|---|---|
| Primary Email | `carlos.martinez@example.com` |
| Password | `Test1234!` |
| Household | Martinez Household |
| State | TX |
| Filing Status | Married Filing Jointly |
| Collaborator Email | `advisor.test@example.com` |

---

## Appendix B — Key Expected Numbers at a Glance

These are the values the engine should produce for the Martinez household with the data entered above.

| Metric | Value |
|---|---|
| Starting Portfolio (2026) | $1,183,000 |
| Annual Income | $230,000 |
| Annual Expenses | $90,000 |
| Home Equity | $370,000 |
| Total Net Worth | ~$1,923,000 |
| Carlos Retirement Year | 2034 (age 65) |
| Elena Retirement Year | 2034 (age 63) |
| Carlos SS at FRA (67) | $33,600/year |
| Elena SS at FRA (67) | $19,200/year |
| Combined SS | $52,800/year |
| Projection End Year | 2061 |
| Expected Simulation Result | ✅ No depletion |
| Expected MC Success Rate | 80–95% |
| Housing Equity Released (2034) | ~$113,000 |

---

## Appendix C — Quick Database Reference

If you need to look up IDs for API testing, connect to the production database via SSH tunnel from the VPS:

```bash
# SSH into the VPS first, then connect to PostgreSQL
# (The DB container is only accessible from within the VPS Docker network)
psql postgres://retirement_user:Rp2026!SecurePass@gogg00g40wosg8kg0404owko:5432/retirement_app

# Get your user ID
SELECT id, email FROM users WHERE email = 'carlos.martinez@example.com';

# Get household ID
SELECT id, name FROM households WHERE "primaryUserId" = '[userId]';

# Get simulation run IDs
SELECT id, "createdAt", success, "firstDepletionYear" FROM simulation_runs ORDER BY "createdAt" DESC LIMIT 5;

# Get invitation tokens
SELECT token, email, role, status, "expiresAt" FROM household_invitations ORDER BY "createdAt" DESC;

# Get notifications
SELECT id, type, title, "isRead", "createdAt" FROM notifications WHERE "userId" = '[userId]' ORDER BY "createdAt" DESC LIMIT 20;
```

---

*Test script version: Phase 18 (Phases 0–18 complete)*
*820 automated tests passing | 0 failures*
