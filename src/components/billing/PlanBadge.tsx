import type { PlanType } from '@/server/billing/types';

interface PlanBadgeProps {
  planType: PlanType;
  className?: string;
}

export function PlanBadge({ planType, className = '' }: PlanBadgeProps) {
  if (planType === 'PRO') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 ${className}`}>
        <span>⭐</span> Pro
      </span>
    );
  }

  if (planType === 'ADVISOR') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 ${className}`}>
        <span>🔑</span> Advisor
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 ${className}`}>
      Free
    </span>
  );
}
