import Link from 'next/link';
import type { PlanHealthSummary } from '@/server/dashboard/types';

const statusColors = {
  ON_TRACK: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', text: 'text-green-700', ring: '#16a34a' },
  NEEDS_ATTENTION: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', text: 'text-yellow-700', ring: '#ca8a04' },
  AT_RISK: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', text: 'text-red-700', ring: '#dc2626' },
  INCOMPLETE: { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700', text: 'text-slate-700', ring: '#94a3b8' },
};

function ScoreRing({ score, color, size = 88 }: { score: number; color: string; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / 100, 1);
  const offset = circumference * (1 - pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.26} fontWeight={700} fill={color}>{score}</text>
    </svg>
  );
}

export function PlanHealthHeroCard({ planHealth }: { planHealth: PlanHealthSummary }) {
  const colors = statusColors[planHealth.status];

  return (
    <div className={`rounded-2xl border-2 p-6 md:p-8 ${colors.bg} ${colors.border}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Score or Icon */}
        <div className="flex-shrink-0 flex items-center justify-center">
          {planHealth.score !== null ? (
            <ScoreRing score={planHealth.score} color={colors.ring} size={96} />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-3xl">📋</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className={`text-lg font-bold ${colors.text}`}>Retirement Plan Health</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
              {planHealth.statusLabel}
              {planHealth.score !== null ? ` · ${planHealth.score}/100` : ''}
            </span>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed mb-4 max-w-xl">
            {planHealth.explanation}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/overview#next-steps"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              See What To Do Next →
            </Link>
            <Link
              href="/app/plan-health"
              className="px-4 py-2 text-slate-700 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
            >
              View Full Analysis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
