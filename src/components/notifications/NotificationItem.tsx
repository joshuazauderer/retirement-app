'use client';

import type { NotificationRecord } from '@/server/notifications/types';

interface NotificationItemProps {
  notification:  NotificationRecord;
  onMarkRead:    (id: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  PLAN_RISK_HIGH:                  '⚠️',
  PLAN_RISK_CRITICAL:              '🚨',
  SIMULATION_COMPLETE:             '✅',
  PORTFOLIO_DEPLETION_ALERT:       '📉',
  COLLABORATION_INVITE:            '📨',
  COLLABORATION_ACCEPTED:          '🤝',
  MEMBER_REMOVED:                  '🔒',
  BILLING_PAYMENT_FAILED:          '💳',
  BILLING_SUBSCRIPTION_CANCELLED:  '❌',
  BILLING_TRIAL_ENDING:            '⏳',
  WEEKLY_DIGEST:                   '📊',
  MONTHLY_DIGEST:                  '📅',
  SYSTEM_ANNOUNCEMENT:             'ℹ️',
};

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const icon      = TYPE_ICONS[notification.type] ?? '🔔';
  const timeLabel = formatRelativeTime(notification.createdAt);

  return (
    <div
      className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
        notification.isRead ? 'opacity-60' : ''
      }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-lg" aria-hidden="true">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium text-slate-900 leading-snug ${notification.isRead ? '' : 'font-semibold'}`}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-600" aria-label="Unread" />
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
          {notification.body}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-400">{timeLabel}</span>
          {!notification.isRead && (
            <button
              onClick={() => onMarkRead(notification.id)}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Mark read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now    = Date.now();
  const ts     = new Date(date).getTime();
  const diffMs = now - ts;
  const diffMin  = Math.floor(diffMs / 60_000);
  const diffHr   = Math.floor(diffMin  / 60);
  const diffDay  = Math.floor(diffHr   / 24);

  if (diffMin  < 1)   return 'just now';
  if (diffMin  < 60)  return `${diffMin}m ago`;
  if (diffHr   < 24)  return `${diffHr}h ago`;
  if (diffDay  < 7)   return `${diffDay}d ago`;

  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
