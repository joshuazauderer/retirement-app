'use client';

import { useState, useEffect } from 'react';
import type { InsightInput, InsightOutput } from '@/server/ai/types';
import { RiskBadge } from './RiskBadge';
import { InsightCard } from './InsightCard';

interface InsightPanelProps {
  input: InsightInput;
  className?: string;
}

interface GenerateInsightResult {
  output: InsightOutput;
  fromCache: boolean;
  fromFallback: boolean;
  error?: string;
}

export function InsightPanel({ input, className = '' }: InsightPanelProps) {
  const [result, setResult] = useState<GenerateInsightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchInsight() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch('/api/ai-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const data: GenerateInsightResult = await res.json();
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load insight');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInsight();
    return () => { cancelled = true; };
  }, [input.runId, input.insightType]);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-slate-900">AI Insights</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
            Beta
          </span>
        </div>
        {result?.fromCache && (
          <span className="text-xs text-slate-400">Cached</span>
        )}
        {result?.fromFallback && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            AI unavailable — showing deterministic summary
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-5 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <span className="text-sm text-slate-500">Generating insight...</span>
            </div>
          </div>
        )}

        {fetchError && !loading && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            Failed to load insight: {fetchError}
          </div>
        )}

        {result && !loading && (
          <>
            {/* Summary */}
            <InsightCard title="Plan Summary" variant={result.output.risks.length > 0 ? 'default' : 'success'}>
              <p className="leading-relaxed">{result.output.summary}</p>
            </InsightCard>

            {/* Key Insights */}
            {result.output.keyInsights.length > 0 && (
              <InsightCard title="Key Insights">
                <ul className="space-y-1.5">
                  {result.output.keyInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-500 flex-shrink-0">&#9679;</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </InsightCard>
            )}

            {/* Risk Flags */}
            {result.output.risks.length > 0 && (
              <InsightCard title="Risk Factors" variant="warning">
                <div className="flex flex-wrap gap-2 mb-3">
                  <RiskBadge risk="Depletion Risk" active={input.risks.earlyDepletionRisk} />
                  <RiskBadge risk="Sequence Risk" active={input.risks.sequenceRisk} />
                  <RiskBadge risk="Longevity Risk" active={input.risks.longevityRisk} />
                  <RiskBadge risk="Tax Risk" active={input.risks.taxInefficiencyRisk} />
                  <RiskBadge risk="Healthcare Risk" active={input.risks.healthcareRisk} />
                </div>
                <ul className="space-y-1.5">
                  {result.output.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-amber-800">
                      <span className="mt-0.5 text-amber-500 flex-shrink-0" aria-hidden="true">&#9888;</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </InsightCard>
            )}

            {/* Recommendations — collapsible */}
            {result.output.recommendations.length > 0 && (
              <div className="rounded-lg border border-slate-200">
                <button
                  onClick={() => setRecommendationsExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <span>Options to Consider ({result.output.recommendations.length})</span>
                  <span className="text-slate-400" aria-hidden="true">
                    {recommendationsExpanded ? '&#8963;' : '&#8964;'}
                  </span>
                </button>
                {recommendationsExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
                    {result.output.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 text-slate-400 flex-shrink-0">&#8250;</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Confidence Notes */}
            {result.output.confidenceNotes.length > 0 && (
              <div className="space-y-1">
                {result.output.confidenceNotes.map((note, i) => (
                  <p key={i} className="text-xs text-slate-400 italic leading-relaxed">
                    {note}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
        <p className="text-xs text-slate-400 text-center">
          AI insights are planning-grade explanations, not financial advice. Consult a qualified financial professional for personalized guidance.
        </p>
      </div>
    </div>
  );
}
