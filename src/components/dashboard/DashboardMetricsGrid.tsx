import Link from 'next/link';
import type { DashboardMetricCard } from '@/server/dashboard/types';

export function DashboardMetricsGrid({ metrics }: { metrics: DashboardMetricCard[] }) {
  return (
    <div>
      <h2 className="font-semibold text-slate-900 mb-3">Key Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map(metric => (
          <Link
            key={metric.label}
            href={metric.href ?? '#'}
            className={`rounded-xl border p-4 transition-all ${
              metric.available
                ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                : 'bg-slate-50 border-slate-100 cursor-default'
            }`}
          >
            <p className="text-xs text-slate-500 font-medium leading-tight mb-1.5">{metric.label}</p>
            <p className={`text-lg font-bold leading-tight ${metric.available ? 'text-slate-900' : 'text-slate-400'}`}>
              {metric.value}
            </p>
            {metric.subtext && (
              <p className={`text-xs mt-0.5 ${metric.available ? 'text-slate-500' : 'text-slate-400'}`}>
                {metric.subtext}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
