import Link from 'next/link';
import type { DashboardInsightSummary } from '@/server/dashboard/types';

export function AIInsightSummaryCard({ insight }: { insight: DashboardInsightSummary }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-semibold text-slate-900">Insights About Your Plan</h2>
        {insight.fromAI && (
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">AI</span>
        )}
      </div>

      {insight.available ? (
        <>
          <p className="text-slate-800 text-sm font-medium leading-relaxed mb-2">
            {insight.headline}
          </p>
          {insight.detail && (
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              {insight.detail}
            </p>
          )}
        </>
      ) : (
        <p className="text-slate-500 text-sm mb-4">
          Run your first projection to see personalized insights about your plan.
        </p>
      )}

      <div className="flex gap-2">
        <Link href="/app/copilot"
          className="px-3 py-1.5 text-sm text-white font-medium bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">
          Ask Copilot →
        </Link>
        <Link href="/app/ai-insights"
          className="px-3 py-1.5 text-sm text-purple-600 font-medium border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
          View All Insights
        </Link>
      </div>
    </div>
  );
}
