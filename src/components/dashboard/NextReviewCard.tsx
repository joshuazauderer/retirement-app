import Link from 'next/link';
import type { ReviewCadenceSummary } from '@/server/dashboard/types';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function NextReviewCard({ review }: { review: ReviewCadenceSummary }) {
  const { hasReviewSchedule, nextReviewDate, isOverdue, cadenceLabel } = review;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-900 mb-1">Next Plan Review</h2>

      {!hasReviewSchedule ? (
        <>
          <p className="text-slate-500 text-sm mb-4">You haven&apos;t set a review cadence yet.</p>
          <p className="text-xs text-slate-500 mb-3">
            Review your plan regularly to catch changes before they become problems.
          </p>
        </>
      ) : isOverdue ? (
        <>
          <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 mb-3">
            ⚠ Review overdue
          </span>
          <p className="text-slate-600 text-sm mb-4">
            You&apos;re due for your {cadenceLabel.toLowerCase()} plan review. It only takes a few minutes.
          </p>
        </>
      ) : (
        <>
          {nextReviewDate && (
            <p className="text-slate-700 text-sm font-medium mb-1">
              Next review: {formatDate(nextReviewDate)}
            </p>
          )}
          <p className="text-slate-500 text-xs mb-4">{cadenceLabel} review schedule</p>
        </>
      )}

      <div className="space-y-2">
        <Link href="/app/simulations"
          className="w-full block text-center py-2 text-sm text-white font-medium bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          Review Now →
        </Link>
        <Link href="/app/settings/notifications"
          className="w-full block text-center py-2 text-sm text-slate-600 font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          Set Reminder
        </Link>
      </div>
    </div>
  );
}
