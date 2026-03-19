'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AcceptInviteButtonProps {
  token: string;
}

export default function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/collaboration/invitations/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to accept invitation');
      } else {
        router.push('/app/overview?invited=1');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full bg-blue-600 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Accepting...' : 'Accept Invitation'}
      </button>
      <p className="text-xs text-slate-400 text-center">
        By accepting, you agree to access this household&apos;s retirement planning data within the permissions granted.
      </p>
    </div>
  );
}
