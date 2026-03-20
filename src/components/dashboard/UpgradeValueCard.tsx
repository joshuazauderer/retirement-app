import Link from 'next/link';
import type { DashboardUpgradePrompt } from '@/server/dashboard/types';

export function UpgradeValueCard({ upgrade }: { upgrade: DashboardUpgradePrompt }) {
  if (!upgrade.show) return null;

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🔓</span>
            <h2 className="font-bold text-slate-900">{upgrade.headline}</h2>
          </div>
          <p className="text-slate-600 text-sm mb-4 max-w-lg">{upgrade.body}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {upgrade.featuredFeatures.map(f => (
              <span key={f} className="text-xs bg-white border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                {f}
              </span>
            ))}
          </div>
          <Link
            href={upgrade.ctaHref}
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {upgrade.ctaLabel} →
          </Link>
        </div>
      </div>
    </div>
  );
}
