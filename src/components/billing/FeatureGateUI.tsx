import Link from 'next/link';
import type { PlanType } from '@/server/billing/types';

interface FeatureGateUIProps {
  featureName: string;
  requiredPlan?: PlanType | string;
  children: React.ReactNode;
  allowed: boolean;
}

export function FeatureGateUI({ featureName, requiredPlan, children, allowed }: FeatureGateUIProps) {
  if (allowed) {
    return <>{children}</>;
  }

  const planLabel = requiredPlan ? requiredPlan.charAt(0) + requiredPlan.slice(1).toLowerCase() : 'Pro';
  const featureLabel = featureName.replace(/_/g, ' ');

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
      <div className="text-4xl">🔒</div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 capitalize">{featureLabel}</h3>
        <p className="mt-1 text-sm text-slate-600">
          This feature requires the{' '}
          <span className="font-semibold">{planLabel}</span> plan.
        </p>
      </div>
      <Link
        href="/app/settings/billing"
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Upgrade to {planLabel}
      </Link>
    </div>
  );
}
