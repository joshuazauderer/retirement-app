'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import type { NotificationRecord } from '@/server/notifications/types';
import { NotificationItem } from './NotificationItem';

interface NotificationDropdownProps {
  notifications: NotificationRecord[];
  unreadCount:   number;
  onMarkRead:    (id: string) => void;
  onMarkAllRead: () => void;
  onClose:       () => void;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: NotificationDropdownProps) {
  const handleMarkRead = useCallback(
    (id: string) => {
      onMarkRead(id);
    },
    [onMarkRead],
  );

  return (
    <>
      {/* Backdrop (invisible, closes on click) */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Dropdown panel */}
      <div
        className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden"
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-2xl mb-2">🔔</p>
              <p className="text-sm text-slate-500">No notifications yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                We&apos;ll alert you when your plan needs attention.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={handleMarkRead}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
            <Link
              href="/app/settings/notifications"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Manage notification preferences →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
