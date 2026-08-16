/**
 * src/pages/volunteer/VolunteerTasks.jsx
 * Volunteer dashboard — View assigned deliveries & update status.
 * Real-time CRUD:
 *   READ   – GET /deliveries/mine
 *   UPDATE – PUT /deliveries/update-status
 */

import { useState, useCallback } from 'react';
import { useAuth }               from '../../context/AuthContext';
import { useApi, useApiMutation } from '../../hooks/useApi';
import { LoadingOverlay }        from '../../components/ui/Spinner';
import StatusBadge               from '../../components/ui/StatusBadge';
import { Icons }                  from '../../components/ui/Icons';

/* ── helpers ───────────────────────────────────────────────────────────────── */
function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={[
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5',
      'shadow-lg text-sm font-medium',
      toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white',
    ].join(' ')}>
      {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
    </div>
  );
}

/* ── Status transitions for volunteer ──────────────────────────────────────── */
const NEXT_STATUS = {
  assigned:  ['picked_up', 'failed'],
  picked_up: ['delivered', 'failed'],
  delivered: [],
  failed:    [],
};

const STATUS_LABELS = {
  picked_up: 'Mark Picked Up',
  delivered: 'Mark Delivered',
  failed:    'Mark Failed',
};

/* ── Delivery Card ─────────────────────────────────────────────────────────── */
function DeliveryCard({ delivery, onUpdate, updating }) {
  const next = NEXT_STATUS[delivery.status] ?? [];
  const isActive = ['assigned', 'picked_up'].includes(delivery.status);

  return (
    <div className={[
      'card p-5 space-y-3 transition-all',
      isActive ? 'border-l-4 border-l-emerald-500' : 'opacity-70',
    ].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{delivery.food_name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{delivery.food_type} · qty {delivery.quantity}</p>
        </div>
        <StatusBadge status={delivery.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-gray-400 mb-0.5">Pickup from</p>
          <p className="font-medium text-gray-700">{delivery.donor_name}</p>
          <p className="text-gray-500">{delivery.donor_location || '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-gray-400 mb-0.5">Deliver to</p>
          <p className="font-medium text-gray-700">{delivery.receiver_name}</p>
          {delivery.pickup_note && (
            <p className="text-gray-500 italic">"{delivery.pickup_note}"</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 text-xs text-gray-400 flex-wrap">
        {delivery.pickup_time && (
          <span>🚗 Picked up: {fmt(delivery.pickup_time)}</span>
        )}
        {delivery.delivered_time && (
          <span>✅ Delivered: {fmt(delivery.delivered_time)}</span>
        )}
        {!delivery.pickup_time && !delivery.delivered_time && (
          <span>📅 Created: {fmt(delivery.created_at)}</span>
        )}
      </div>

      {next.length > 0 && (
        <div className="flex gap-2 flex-wrap pt-1">
          {next.map(s => (
            <button
              key={s}
              onClick={() => onUpdate(delivery.delivery_id, s)}
              disabled={updating}
              className={[
                'text-xs py-2 px-4 rounded-lg font-medium transition-colors',
                s === 'delivered' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
                s === 'failed'    ? 'bg-red-100 hover:bg-red-200 text-red-700' :
                                    'btn-primary',
              ].join(' ')}
            >
              {updating ? '…' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */
export default function VolunteerTasks() {
  const { user }  = useAuth();
  const [filter, setFilter] = useState('');     // '' | 'assigned' | 'picked_up' | 'delivered' | 'failed'
  const [toast, setToast]   = useState(null);
  const { mutate, loading: updating } = useApiMutation();

  /* ── Data ─────────────────────────────────────────────────────────────── */
  const {
    data, loading, error, refetch,
  } = useApi('/deliveries/mine', {
    params: { limit: 50, status: filter || undefined },
  });

  const deliveries = data?.data ?? [];
  const active     = deliveries.filter(d => ['assigned','picked_up'].includes(d.status));
  const done       = deliveries.filter(d => ['delivered','failed'].includes(d.status));

  /* ── Toast ───────────────────────────────────────────────────────────── */
  const toast$ = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── Status update handler ───────────────────────────────────────────── */
  const handleUpdate = async (delivery_id, status) => {
    try {
      await mutate('put', '/deliveries/update-status', { delivery_id, status });
      const labels = { picked_up: 'Picked Up', delivered: 'Delivered ✅', failed: 'Failed' };
      toast$(`Delivery marked as "${labels[status]}"`);
      refetch();
    } catch (e) {
      toast$(e?.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="page-header mb-0">
          <h1 className="page-title">My Deliveries</h1>
          <p className="page-sub">Manage your assigned delivery tasks, {user?.name} 🚴</p>
        </div>
        <button onClick={refetch} className="btn-ghost text-sm py-2 px-4 flex items-center gap-1.5 hover:text-emerald-700 transition-colors">
          <Icons.Refresh className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: deliveries.length,                                  emoji: '📋', bg: 'bg-gray-50' },
          { label: 'Assigned',  value: deliveries.filter(d=>d.status==='assigned').length,  emoji: '📌', bg: 'bg-blue-50' },
          { label: 'Picked Up', value: deliveries.filter(d=>d.status==='picked_up').length, emoji: '🚗', bg: 'bg-amber-50' },
          { label: 'Delivered', value: deliveries.filter(d=>d.status==='delivered').length, emoji: '✅', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`card p-4 flex items-center gap-3 ${s.bg}`}>
            <span className="text-2xl">{s.emoji}</span>
            <div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {['', 'assigned', 'picked_up', 'delivered', 'failed'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={[
              'px-4 py-1.5 rounded-full text-xs font-medium border transition-all capitalize',
              filter === s
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400',
            ].join(' ')}
          >
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading && <LoadingOverlay message="Loading deliveries…" />}
      {!loading && error && (
        <div className="text-center py-10 text-red-500 text-sm">{error}</div>
      )}
      {!loading && !error && deliveries.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🚴</p>
          <p className="text-gray-500 font-medium">No deliveries {filter ? `with status "${filter}"` : 'assigned yet'}</p>
          <p className="text-sm text-gray-400 mt-1">The admin will assign tasks to you soon.</p>
        </div>
      )}

      {/* Active tasks first */}
      {!loading && active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Active Tasks ({active.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map(d => (
              <DeliveryCard key={d.delivery_id} delivery={d} onUpdate={handleUpdate} updating={updating} />
            ))}
          </div>
        </div>
      )}

      {/* Completed / failed */}
      {!loading && done.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Completed / Failed ({done.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {done.map(d => (
              <DeliveryCard key={d.delivery_id} delivery={d} onUpdate={handleUpdate} updating={updating} />
            ))}
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
