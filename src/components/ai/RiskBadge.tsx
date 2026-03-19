'use client';

interface RiskBadgeProps {
  risk: string;
  active: boolean;
  className?: string;
}

export function RiskBadge({ risk, active, className = '' }: RiskBadgeProps) {
  if (active) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 ${className}`}
      >
        <span aria-hidden="true">&#9888;</span>
        {risk}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 ${className}`}
    >
      <span className="text-green-600" aria-hidden="true">&#10003;</span>
      {risk}
    </span>
  );
}
