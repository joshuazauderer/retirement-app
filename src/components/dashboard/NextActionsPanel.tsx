import Link from 'next/link';
import type { DashboardActionItem } from '@/server/dashboard/types';

const categoryIcons: Record<DashboardActionItem['category'], string> = {
  setup: '📋',
  analysis: '📊',
  optimization: '⚡',
  upgrade: '🔓',
};

const categoryColors: Record<DashboardActionItem['category'], string> = {
  setup: 'bg-blue-50 border-blue-200',
  analysis: 'bg-purple-50 border-purple-200',
  optimization: 'bg-amber-50 border-amber-200',
  upgrade: 'bg-indigo-50 border-indigo-200',
};

const ctaColors: Record<DashboardActionItem['category'], string> = {
  setup: 'bg-blue-600 hover:bg-blue-700 text-white',
  analysis: 'bg-purple-600 hover:bg-purple-700 text-white',
  optimization: 'bg-amber-600 hover:bg-amber-700 text-white',
  upgrade: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

export function NextActionsPanel({ actions }: { actions: DashboardActionItem[] }) {
  if (actions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Recommended Next Steps</h2>
        <p className="text-slate-500 text-sm">Your plan looks complete. Keep reviewing regularly to stay on track.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-900 mb-1">Recommended Next Steps</h2>
      <p className="text-slate-500 text-xs mb-4">Based on your current plan status</p>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <div key={action.id} className={`rounded-lg border p-4 ${categoryColors[action.category]}`}>
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{categoryIcons[action.category]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {i === 0 && (
                    <span className="text-xs font-semibold bg-blue-600 text-white px-1.5 py-0.5 rounded">Priority</span>
                  )}
                  <h3 className="font-semibold text-slate-900 text-sm">{action.title}</h3>
                </div>
                <p className="text-slate-600 text-xs mb-2 leading-relaxed">{action.description}</p>
                {action.impact && (
                  <p className="text-xs text-slate-500 mb-2">
                    <span className="font-medium">Impact:</span> {action.impact}
                  </p>
                )}
                <Link
                  href={action.ctaHref}
                  className={`inline-block px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${ctaColors[action.category]}`}
                >
                  {action.ctaLabel} →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
