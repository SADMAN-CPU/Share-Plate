/**
 * src/components/ui/NotificationBell.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Navbar notification bell with live unread badge + dropdown panel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';
import { Icons } from './Icons';

const TYPE_ICON = {
  food_expired:    '⏱',
  food_flagged:    '🚩',
  delivery_update: '🚴',
  request_update:  '📋',
  general:         '🔔',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const [open,    setOpen]    = useState(false);
  const [count,   setCount]   = useState(0);
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  /* ── Fetch unread count ──────────────────────────────────────────────────── */
  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setCount(data.count ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  /* ── Fetch full list when panel opens ────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/notifications/mine', { params: { limit: 10 } })
      .then(({ data }) => setNotifs(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  /* ── Close on outside click ──────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Mark all read ───────────────────────────────────────────────────────── */
  const markAllRead = async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setCount(0);
  };

  /* ── Mark one read ───────────────────────────────────────────────────────── */
  const markOneRead = async (id) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifs((prev) => prev.map((n) => n.notification_id === id ? { ...n, is_read: 1 } : n));
    setCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition-all duration-200 group"
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
        aria-expanded={open}
      >
        <Icons.Bell className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center
                           rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm animate-pulse">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
            {count > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading && (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                Loading…
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">
                <Icons.Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="font-medium text-gray-600">You're all caught up!</p>
              </div>
            )}
            {!loading && notifs.map((n) => (
              <button
                key={n.notification_id}
                onClick={() => { if (!n.is_read) markOneRead(n.notification_id); }}
                className={[
                  'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors',
                  n.is_read ? 'hover:bg-gray-50' : 'bg-emerald-50/60 hover:bg-emerald-50',
                ].join(' ')}
              >
                <span className="text-lg mt-0.5 flex-shrink-0">
                  {TYPE_ICON[n.type] ?? '🔔'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm truncate ${n.is_read ? 'text-gray-600' : 'text-gray-900 font-bold'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
