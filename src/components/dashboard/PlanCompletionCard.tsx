import Link from 'next/link';
import type { PlanCompletionSummary } from '@/server/dashboard/types';

const statusStyles = {
  complete: { dot: 'bg-green-500', text: 'text-slate-700' },
  attention: { dot: 'bg-amber-500', text: 'text-slate-700' },
  not_started: { dot: 'bg-slate-300', text: 'text-slate-400' },
};

export function PlanCompletionCard({ completion }: { completion: PlanCompletionSummary }) {
  const { percentage, items } = completion;

  const progressColor = percentage >= 80 ? 'bg-green-500'
    : percentage >= 50 ? 'bg-blue-500'
    : 'bg-amber-500';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-900">Your Plan Progress</h2>
        <span className={`text-2xl font-bold ${percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-blue-600' : 'text-amber-600'}`}>
          {percentage}%
        </span>
      </div>
      <p className="text-slate-500 text-xs mb-3">Complete</p>

      <div className="w-full bg-slate-100 rounded-full h-2 mb-5">
        <div className={`${progressColor} h-2 rounded-full transition-all`} style={{ width: `${percentage}%` }} />
      </div>

      <div className="grid grid-cols-1 gap-1.5 flex-1">
        {items.map(item => {
          const style = statusStyles[item.status];
          return (
            <Link key={item.key} href={item.href}
              className="flex items-center gap-2 text-xs hover:bg-slate-50 rounded px-1 py-0.5 transition-colors group">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
              <span className={`flex-1 ${style.text} group-hover:text-slate-900`}>{item.label}</span>
              {item.status !== 'complete' && (
                <span className="text-slate-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <Link href="/app/income"
          className="w-full block text-center py-2 text-sm text-blue-600 font-medium bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
          {percentage < 100 ? 'Continue Setup →' : 'Plan Complete ✓'}
        </Link>
      </div>
    </div>
  );
}
