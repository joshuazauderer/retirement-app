'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NotificationRecord } from '@/server/notifications/types';
import { NotificationDropdown } from './NotificationDropdown';

interface NotificationListResult {
  notifications: NotificationRecord[];
  unreadCount:   number;
  total:         number;
}

export function NotificationBell() {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);

  // ── Fetch notifications ─────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json() as NotificationListResult;
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();

    // Poll for new notifications every 60 seconds
    const interval = setInterval(() => void fetchNotifications(), 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date() })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  }, []);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
    if (!open && unreadCount > 0) {
      // Refresh on open
      void fetchNotifications();
    }
  }, [open, unreadCount, fetchNotifications]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {/* Bell icon */}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {!loading && unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
