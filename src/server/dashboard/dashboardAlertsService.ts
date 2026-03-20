import { prisma } from '@/lib/prisma';
import type { DashboardAlertSummary, DashboardAlertItem } from './types';

const ALERT_TYPES = new Set([
  'PLAN_RISK_HIGH',
  'PLAN_RISK_CRITICAL',
  'PORTFOLIO_DEPLETION_ALERT',
]);

function severityFromType(type: string): DashboardAlertItem['severity'] {
  if (type === 'PLAN_RISK_CRITICAL' || type === 'PORTFOLIO_DEPLETION_ALERT') return 'critical';
  if (type === 'PLAN_RISK_HIGH') return 'high';
  return 'medium';
}

export async function getDashboardAlerts(userId: string): Promise<DashboardAlertSummary> {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  });

  const alertNotifications = notifications.filter(n => ALERT_TYPES.has(n.type));
  const unreadAlerts = alertNotifications.filter(n => !n.isRead);

  const topAlerts: DashboardAlertItem[] = alertNotifications.slice(0, 5).map(n => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    severity: severityFromType(n.type),
    createdAt: n.createdAt.toISOString(),
    isRead: n.isRead,
  }));

  return {
    count: alertNotifications.length,
    unreadCount: unreadAlerts.length,
    topAlerts,
    hasAlerts: alertNotifications.length > 0,
  };
}
