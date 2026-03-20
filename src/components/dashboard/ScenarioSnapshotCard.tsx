import Link from 'next/link';
import type { ScenarioSnapshotSummary } from '@/server/dashboard/types';

export function ScenarioSnapshotCard({ scenarios }: { scenarios: ScenarioSnapshotSummary }) {
  if (!scenarios.hasScenarios) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Your Plan vs Alternatives</h2>
        <p className="text-slate-500 text-sm mb-4">
          Create scenarios to see how different choices affect your retirement — save more, retire later, or downsize.
        </p>
        <Link href="/app/scenarios"
          className="inline-block px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          Create First Scenario →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-900">Your Plan vs Alternatives</h2>
          <p className="text-slate-500 text-xs mt-0.5">Side-by-side outcome comparison</p>
        </div>
        <Link href="/app/scenarios" className="text-blue-600 text-xs font-medium hover:text-blue-800">
          All Scenarios →
        </Link>
      </div>

      <div className="space-y-2">
        {scenarios.scenarios.map(s => (
          <div key={s.id}
            className={`flex items-center gap-3 rounded-lg p-3 ${s.isBaseline ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 truncate">{s.name}</span>
                {s.isBaseline && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                    Baseline
                  </span>
                )}
              </div>
            </div>
            <span className={`text-xs font-medium flex-shrink-0 ${
              s.firstDepletionYear ? 'text-red-600' : 'text-green-600'
            }`}>
              {s.outcome}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Link href="/app/scenarios"
          className="w-full block text-center py-2 text-sm text-blue-600 font-medium bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
          Explore Scenarios →
        </Link>
      </div>
    </div>
  );
}
