'use client';

import { ReactNode } from 'react';

interface InsightCardProps {
  title: string;
  children: ReactNode;
  variant?: 'default' | 'warning' | 'success';
}

const variantClasses: Record<string, string> = {
  default: 'bg-white border-slate-200',
  warning: 'bg-amber-50 border-amber-200',
  success: 'bg-green-50 border-green-200',
};

const titleClasses: Record<string, string> = {
  default: 'text-slate-800',
  warning: 'text-amber-800',
  success: 'text-green-800',
};

export function InsightCard({ title, children, variant = 'default' }: InsightCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${variantClasses[variant]}`}>
      <h4 className={`text-sm font-semibold mb-2 ${titleClasses[variant]}`}>{title}</h4>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
