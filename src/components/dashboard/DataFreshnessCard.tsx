import Link from 'next/link';
import type { DataFreshnessSummary } from '@/server/dashboard/types';

function formatDaysAgo(days: number | null): string {
  if (days === null) return 'Never updated';
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 30) return `Updated ${days} days ago`;
  if (days < 60) return 'Updated about a month ago';
  const months = Math.floor(days / 30);
  return `Updated ${months} months ago`;
}

export function DataFreshnessCard({ freshness }: { freshness: DataFreshnessSummary }) {
  const { daysSinceLastUpdate, overallIsStale, items, suggestedUpdates } = freshness;

  const statusColor = overallIsStale ? 'text-amber-700 bg-amber-50 border-amber-200'
    : daysSinceLastUpdate === null ? 'text-slate-600 bg-slate-50 border-slate-200'
    : 'text-green-700 bg-green-50 border-green-200';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-900 mb-1">Your Financial Data</h2>
      <div className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border mb-4 ${statusColor}`}>
        {overallIsStale ? '⚠ Some data may be outdated' : formatDaysAgo(daysSinceLastUpdate)}
      </div>

      <div className="space-y-1.5 mb-4">
        {items.filter(i => i.lastUpdated !== null || suggestedUpdates.length === 0).slice(0, 4).map(item => (
          <Link key={item.key} href={item.href}
            className="flex items-center justify-between group hover:bg-slate-50 rounded px-1 py-0.5 transition-colors">
            <span className="text-sm text-slate-700 group-hover:text-slate-900">{item.label}</span>
            <span className={`text-xs ${item.isStale ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
              {item.daysSinceUpdate !== null
                ? item.daysSinceUpdate === 0 ? 'Today'
                : item.daysSinceUpdate < 30 ? `${item.daysSinceUpdate}d ago`
                : `${Math.floor(item.daysSinceUpdate / 30)}mo ago`
                : '—'}
              {item.isStale ? ' · update' : ''}
            </span>
          </Link>
        ))}
      </div>

      {overallIsStale && (
        <p className="text-xs text-slate-500 mb-3">
          Have any of these changed? Usually takes about 2 minutes to update.
        </p>
      )}

      <Link href="/app/income"
        className="w-full block text-center py-2 text-sm text-blue-600 font-medium bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
        Update My Data →
      </Link>
    </div>
  );
}
