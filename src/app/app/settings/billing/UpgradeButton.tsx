'use client';

import { useState } from 'react';
import type { PlanType } from '@/server/billing/types';

interface UpgradeButtonProps {
  planType: PlanType;
  label?: string;
  className?: string;
}

export function UpgradeButton({ planType, label, className = '' }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create checkout session');
      }

      const { url } = await res.json();
      if (!url) throw new Error('No checkout URL returned');

      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      >
        {loading ? (
          <>
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Redirecting to Stripe...
          </>
        ) : (
          label ?? `Upgrade to ${planType === 'PRO' ? 'Pro' : 'Advisor'}`
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
