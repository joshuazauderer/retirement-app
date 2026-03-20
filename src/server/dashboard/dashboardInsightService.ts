import { prisma } from '@/lib/prisma';
import type { DashboardInsightSummary } from './types';
import type { HealthScoreResult } from '@/server/health/types';

export async function getDashboardInsight(
  householdId: string,
  healthScore: HealthScoreResult,
): Promise<DashboardInsightSummary> {
  // Try to get a cached AI insight for this household
  try {
    const cached = await (prisma as any).aiInsightCache.findFirst({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      select: { outputJson: true, createdAt: true },
    });

    if (cached?.outputJson) {
      const output = cached.outputJson as Record<string, unknown>;
      const insightText = typeof output.insightText === 'string'
        ? output.insightText
        : typeof output.text === 'string'
        ? output.text
        : typeof output.summary === 'string'
        ? output.summary
        : null;

      if (insightText) {
        const sentences = insightText.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
        const headline = sentences[0]?.trim() ?? insightText.slice(0, 120);
        const detail = sentences[1]?.trim() ?? null;
        return {
          available: true,
          headline: headline + '.',
          detail: detail ? detail + '.' : null,
          fromAI: true,
        };
      }
    }
  } catch {
    // aiInsightCache not available or query failed — fall through to deterministic
  }

  // Deterministic fallback based on health score
  return buildDeterministicInsight(healthScore);
}

function buildDeterministicInsight(healthScore: HealthScoreResult): DashboardInsightSummary {
  const { tier, topActions, dataAsOf } = healthScore;

  if (!dataAsOf.hasSimulation) {
    return {
      available: true,
      headline: 'Run your first projection to see personalized insights about your retirement plan.',
      detail: 'Once your projection is complete, we\'ll highlight the key opportunities and risks in your plan.',
      fromAI: false,
    };
  }

  const insightMap: Record<string, { headline: string; detail: string }> = {
    EXCELLENT: {
      headline: 'Your retirement plan is in excellent shape.',
      detail: topActions[0] ? `Your biggest remaining opportunity: ${topActions[0].toLowerCase()}.` : 'Continue reviewing your plan annually to stay on track.',
    },
    GOOD: {
      headline: 'Your plan is on solid ground with room to improve.',
      detail: topActions[0] ? `Focus on: ${topActions[0].toLowerCase()}.` : 'A few targeted improvements could push your plan to excellent.',
    },
    FAIR: {
      headline: 'Your plan has meaningful gaps worth addressing soon.',
      detail: topActions[0] ? `The most important next step: ${topActions[0].toLowerCase()}.` : 'Review the recommended actions to strengthen your retirement position.',
    },
    AT_RISK: {
      headline: 'Your plan has significant gaps that may affect retirement security.',
      detail: topActions[0] ? `Start with: ${topActions[0].toLowerCase()}.` : 'Act on the recommended next steps to reduce your retirement risk.',
    },
    CRITICAL: {
      headline: 'Your plan needs immediate attention to meet your retirement goals.',
      detail: topActions[0] ? `Critical first step: ${topActions[0].toLowerCase()}.` : 'Multiple critical gaps require your attention before you can retire with confidence.',
    },
  };

  const insight = insightMap[tier] ?? insightMap.FAIR;
  return { available: true, headline: insight.headline, detail: insight.detail, fromAI: false };
}
