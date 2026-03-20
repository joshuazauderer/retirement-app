import Link from 'next/link';
import type { DashboardAlertSummary } from '@/server/dashboard/types';

const severityStyles = {
  critical: 'bg-red-50 border-red-200 text-red-700',
  high: 'bg-orange-50 border-orange-200 text-orange-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low: 'bg-blue-50 border-blue-200 text-blue-700',
};

const severityIcons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function AlertsSummaryCard({ alerts }: { alerts: DashboardAlertSummary }) {
  if (!alerts.hasAlerts) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-900">Alerts</h2>
          <Link href="/app/settings/notifications" className="text-blue-600 text-xs font-medium hover:text-blue-800">
            Manage →
          </Link>
        </div>
        <div className="flex items-center gap-2 text-green-600">
          <span>✓</span>
          <p className="text-sm">No active alerts — your plan looks good.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-900">Alerts</h2>
          {alerts.unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
              {alerts.unreadCount}
            </span>
          )}
        </div>
        <Link href="/app/notifications" className="text-blue-600 text-xs font-medium hover:text-blue-800">
          View All →
        </Link>
      </div>

      <div className="space-y-2">
        {alerts.topAlerts.map(alert => (
          <div key={alert.id} className={`rounded-lg border p-3 ${severityStyles[alert.severity]} ${!alert.isRead ? 'font-medium' : ''}`}>
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">{severityIcons[alert.severity]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight">{alert.title}</p>
                <p className="text-xs opacity-75 mt-0.5">{formatTimeAgo(alert.createdAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Link href="/app/notifications"
        className="w-full block text-center py-2 text-sm text-blue-600 font-medium bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors mt-3">
        View All Alerts →
      </Link>
    </div>
  );
}
