/**
 * Phase 11 Housing + Legacy Planning Types
 *
 * Planning-grade housing decision and legacy projection types.
 * Not real-estate transaction software. Not legal estate-planning software.
 */

export type HousingStrategy = 'stay_in_place' | 'downsize' | 'relocate' | 'rent';

export interface PropertyAssumptions {
  currentValue: number;           // Current estimated property value
  mortgageBalance: number;        // Current outstanding mortgage balance
  annualAppreciationRate: number; // Expected annual appreciation (e.g. 0.03 = 3%)
  annualHousingCost: number;      // Annual total housing cost (mortgage P&I + taxes + insurance + maintenance)
  annualMortgagePayment: number;  // Annual mortgage payment (P&I only)
  mortgagePayoffYear?: number;    // Year mortgage is paid off (0 = already paid off)
}

export interface DownsizingConfig {
  enabled: boolean;
  eventYear: number;              // Year of the sale
  expectedSalePrice: number;      // Expected gross sale price
  sellingCostPercent: number;     // Selling costs as % of sale price (e.g. 0.06 = 6%)
  mortgagePayoffAmount: number;   // Remaining mortgage balance at time of sale
  buyReplacementHome: boolean;    // Whether purchasing a replacement home
  replacementHomeCost: number;    // Purchase price of replacement home (if buying)
  replacementHomeMortgage: number; // Mortgage on replacement (0 = cash purchase)
  postMoveAnnualHousingCost: number; // Annual housing cost after the move
  oneTimeMoveCost: number;        // One-time moving expenses
}

export interface RelocationConfig {
  enabled: boolean;
  eventYear: number;
  destinationState: string;       // 2-letter state code
  newAnnualHousingCost: number;   // New annual housing cost after move
  oneTimeMoveCost: number;        // One-time moving expenses
  buyReplacementHome: boolean;
  replacementHomeCost: number;
  replacementHomeMortgage: number;
}

export interface GiftingConfig {
  enabled: boolean;
  annualGiftAmount: number;       // Annual gifting (e.g. annual exclusion gifts)
  oneTimeGiftYear?: number;       // Optional one-time larger gift
  oneTimeGiftAmount?: number;
}

export interface HousingPlanningInput {
  householdId: string;
  scenarioId: string;
  label: string;

  strategy: HousingStrategy;
  currentProperty: PropertyAssumptions;

  // Event configs (only one primary housing event per run)
  downsizing: DownsizingConfig;
  relocation: RelocationConfig;

  // Legacy and gifting
  gifting: GiftingConfig;
  includeLegacyProjection: boolean;

  // General
  generalInflationRate: number;   // For housing-cost inflation (e.g. 0.025)
}

export interface EquityReleaseResult {
  grossSalePrice: number;
  sellingCosts: number;
  mortgagePayoff: number;
  replacementHomeCost: number;
  oneTimeMoveCost: number;
  netReleasedEquity: number;      // Cash added to investable assets
}

export interface HousingYearResult {
  year: number;
  primaryAge: number;
  spouseAge?: number;

  // Housing status
  strategy: HousingStrategy;
  housingEventOccurred: boolean;  // True in the event year
  equityReleased: number;         // Cash released this year (0 except event year)

  // Costs
  annualHousingCost: number;
  mortgagePayment: number;        // 0 if paid off or no mortgage
  oneTimeCost: number;            // Move cost, etc. (0 most years)
  giftingAmount: number;          // Annual gift this year

  // Property values
  estimatedPropertyValue: number; // End of year estimated value
  estimatedMortgageBalance: number; // End of year mortgage balance
  estimatedRealEstateEquity: number; // Property value minus mortgage

  // Cash-flow integration
  totalExpenses: number;
  withdrawals: number;
  endingAssets: number;
  depleted: boolean;

  // Legacy
  projectedLegacyValue?: number;
}

export interface LegacyProjectionResult {
  projectionYear: number;
  endingFinancialAssets: number;
  endingRealEstateEquity: number;
  endingLiabilities: number;
  projectedNetEstate: number;     // = financial + RE equity - liabilities
  totalLifetimeGifting: number;
  note: string;
}

export interface HousingPlanningRunSummary {
  strategy: HousingStrategy;
  projectionStartYear: number;
  projectionEndYear: number;

  // Housing event
  housingEventYear?: number;
  netReleasedEquity: number;
  totalLifetimeHousingCost: number;
  totalLifetimeGifting: number;

  // End-state
  endingFinancialAssets: number;
  endingRealEstateEquity: number;
  projectedNetEstate: number;
  success: boolean;
  firstDepletionYear?: number;

  peakAnnualHousingCost: number;
  averageAnnualHousingCost: number;
}

export interface HousingPlanningRunResult {
  runId: string;
  label: string;
  scenarioName: string;
  createdAt: string;

  summary: HousingPlanningRunSummary;
  yearByYear: HousingYearResult[];
  equityRelease?: EquityReleaseResult;
  legacyProjection?: LegacyProjectionResult;
  config: HousingPlanningInput;
}

export interface HousingPlanningSummaryItem {
  runId: string;
  label: string;
  scenarioName: string;
  createdAt: string;
  strategy: HousingStrategy;
  netReleasedEquity: number;
  endingFinancialAssets: number;
  projectedNetEstate: number;
  success: boolean;
  firstDepletionYear?: number;
  hasDownsizing: boolean;
  hasRelocation: boolean;
}

export interface HousingComparisonResult {
  runA: { runId: string; label: string };
  runB: { runId: string; label: string };
  configDiffs: Array<{ label: string; a: string; b: string }>;
  outcomeDiffs: Array<{ label: string; a: string; b: string; delta: string; direction: 'better' | 'worse' | 'neutral' }>;
  yearByYearDelta: Array<{ year: number; housingCostA: number; housingCostB: number; delta: number }>;
}

export interface HousingPlanningValidation {
  valid: boolean;
  errors: string[];
}

// Default assumptions
export const DEFAULT_APPRECIATION_RATE = 0.03;       // 3% annual home appreciation
export const DEFAULT_SELLING_COST_PERCENT = 0.06;    // 6% selling costs
export const DEFAULT_GENERAL_INFLATION = 0.025;
export const DEFAULT_MAINTENANCE_RATE = 0.01;        // 1% of home value/yr for maintenance
