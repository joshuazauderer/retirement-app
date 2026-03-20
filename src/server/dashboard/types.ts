import type { HealthScoreTier } from '@/server/health/types';
import type { PlanType } from '@/server/billing/types';

export type DashboardPlanStatus = 'ON_TRACK' | 'NEEDS_ATTENTION' | 'AT_RISK' | 'INCOMPLETE';

export interface PlanHealthSummary {
  score: number | null;
  status: DashboardPlanStatus;
  statusLabel: string;
  explanation: string;
  tier: HealthScoreTier | null;
  topAction: string | null;
  hasSimulation: boolean;
}

export interface DashboardActionItem {
  id: string;
  title: string;
  description: string;
  impact: string | null;
  ctaLabel: string;
  ctaHref: string;
  priority: number;
  category: 'setup' | 'analysis' | 'optimization' | 'upgrade';
}

export interface PlanCompletionItem {
  key: string;
  label: string;
  status: 'complete' | 'attention' | 'not_started';
  href: string;
}

export interface PlanCompletionSummary {
  percentage: number;
  items: PlanCompletionItem[];
  coreDataComplete: boolean;
  hasRunSimulation: boolean;
  hasMonteCarlo: boolean;
  hasAnyAdvancedAnalysis: boolean;
}

export interface DashboardMetricCard {
  label: string;
  value: string;
  subtext?: string;
  available: boolean;
  href?: string;
}

export interface ScenarioSnapshotRow {
  id: string;
  name: string;
  outcome: string;
  isBaseline: boolean;
  endingBalance: number | null;
  firstDepletionYear: number | null;
  projectionEndYear: number | null;
}

export interface ScenarioSnapshotSummary {
  hasScenarios: boolean;
  scenarios: ScenarioSnapshotRow[];
}

export interface DataFreshnessItem {
  label: string;
  key: string;
  lastUpdated: string | null;  // ISO string
  daysSinceUpdate: number | null;
  isStale: boolean;
  href: string;
}

export interface DataFreshnessSummary {
  lastUpdated: string | null;  // ISO string - most recent across all
  daysSinceLastUpdate: number | null;
  overallIsStale: boolean;
  items: DataFreshnessItem[];
  suggestedUpdates: string[];
}

export interface ReviewCadenceSummary {
  hasReviewSchedule: boolean;
  nextReviewDate: string | null;  // ISO string
  isOverdue: boolean;
  cadenceLabel: string;
  lastActivityDate: string | null;  // ISO string
}

export interface DashboardInsightSummary {
  available: boolean;
  headline: string;
  detail: string | null;
  fromAI: boolean;
}

export interface DashboardAlertItem {
  id: string;
  title: string;
  body: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;  // ISO string
  isRead: boolean;
}

export interface DashboardAlertSummary {
  count: number;
  unreadCount: number;
  topAlerts: DashboardAlertItem[];
  hasAlerts: boolean;
}

export interface DashboardUpgradePrompt {
  show: boolean;
  planType: PlanType;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  featuredFeatures: string[];
}

export interface DashboardOverviewViewModel {
  planHealth: PlanHealthSummary;
  nextActions: DashboardActionItem[];
  completion: PlanCompletionSummary;
  metrics: DashboardMetricCard[];
  scenarios: ScenarioSnapshotSummary;
  dataFreshness: DataFreshnessSummary;
  reviewCadence: ReviewCadenceSummary;
  insight: DashboardInsightSummary;
  alerts: DashboardAlertSummary;
  upgradePrompt: DashboardUpgradePrompt;
  householdName: string;
  isNewUser: boolean;
}
