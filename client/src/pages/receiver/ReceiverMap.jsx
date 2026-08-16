/**
 * src/pages/receiver/ReceiverMap.jsx
 * Receiver dashboard — Browse available food & request donations.
 * Real-time CRUD:
 *   READ   – GET /food/available  (with search + filter)
 *   CREATE – POST /requests/create
 *   READ   – GET /requests/mine   (own request history)
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

/* ── Food Card ─────────────────────────────────────────────────────────────── */
function FoodCard({ food, onRequest, requesting }) {
  const [note, setNote]   = useState('');
  const [open, setOpen]   = useState(false);
  const [sending, setSend] = useState(false);

  const submit = async () => {
    setSend(true);
    await onRequest(food.food_id, note);
    setSend(false);
    setOpen(false);
    setNote('');
  };

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">{food.food_name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">by {food.donor_name} · {food.donor_location || 'Unknown location'}</p>
        </div>
        <span className="inline-block bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full capitalize whitespace-nowrap">
          {food.food_type}
        </span>
      </div>

      {food.description && (
        <p className="text-sm text-gray-600 line-clamp-2">{food.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>📦 Qty: <strong>{food.quantity}</strong></span>
        <span>⏰ Expires: <strong>{fmt(food.expiry_time)}</strong></span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        {food.is_freshly_cooked    && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">✓ Fresh</span>}
        {food.proper_packaging     && <span className="bg-blue-50  text-blue-600  px-2 py-0.5 rounded-full">✓ Packed</span>}
        {food.hygiene_maintained   && <span className="bg-teal-50  text-teal-600  px-2 py-0.5 rounded-full">✓ Hygienic</span>}
        {food.allergen_declared    && <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">✓ Allergens</span>}
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="btn-primary w-full text-sm py-2"
        >
          Request This Food
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={2}
            placeholder="Optional note (pickup time, address, etc.)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="input-field resize-none text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={sending}
              className="btn-primary flex-1 text-sm py-2"
            >
              {sending ? 'Sending…' : 'Confirm Request'}
            </button>
            <button
              onClick={() => { setOpen(false); setNote(''); }}
              className="btn-ghost flex-1 text-sm py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */
export default function ReceiverMap() {
  const { user }  = useAuth();
  const [tab, setTab]       = useState('browse');    // 'browse' | 'history'
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [toast, setToast]   = useState(null);
  const { mutate } = useApiMutation();

  /* ── Data ─────────────────────────────────────────────────────────────── */
  const {
    data: foodData, loading: foodLoading, error: foodErr, refetch: refetchFood,
  } = useApi('/food/available', {
    params: {
      limit: 50,
      search:    search    || undefined,
      food_type: typeFilter || undefined,
    },
  });

  const {
    data: reqData, loading: reqLoading, error: reqErr, refetch: refetchReqs,
  } = useApi('/requests/mine', { params: { limit: 50 } });

  const foods    = foodData?.data ?? [];
  const myReqs   = reqData?.data  ?? [];

  /* ── Toast ───────────────────────────────────────────────────────────── */
  const toast$ = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── Request handler ─────────────────────────────────────────────────── */
  const handleRequest = async (food_id, pickup_note) => {
    try {
      await mutate('post', '/requests/create', { food_id, pickup_note: pickup_note || null });
      toast$('Request submitted! The donor will be notified.');
      refetchFood();
      refetchReqs();
    } catch (e) {
      toast$(e?.response?.data?.message || 'Failed to submit request', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-header">
        <h1 className="page-title">Food Browser</h1>
        <p className="page-sub">Browse and request available food donations near you 🗺️</p>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'browse',  label: `Browse (${foods.length})` },
          { key: 'history', label: `My Requests (${myReqs.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-5 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BROWSE TAB ──────────────────────────────────────────────────── */}
      {tab === 'browse' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search food…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 text-sm"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="input-field text-sm w-auto"
            >
              <option value="">All Types</option>
              {['cooked','raw','packaged','beverage','other'].map(t => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
            <button onClick={refetchFood} className="btn-ghost text-sm py-2 px-4 flex items-center gap-1.5 hover:text-emerald-700 transition-colors">
              <Icons.Refresh className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>

          {foodLoading && <LoadingOverlay message="Finding available food…" />}
          {!foodLoading && foodErr && (
            <div className="text-center py-10 text-red-500 text-sm">{foodErr}</div>
          )}
          {!foodLoading && !foodErr && foods.length === 0 && (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-gray-500 font-medium">No food available right now</p>
              <p className="text-sm text-gray-400 mt-1">Check back soon or clear your filters.</p>
            </div>
          )}
          {!foodLoading && foods.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {foods.map(food => (
                <FoodCard key={food.food_id} food={food} onRequest={handleRequest} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── MY REQUESTS TAB ─────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">My Request History</h2>
            <button onClick={refetchReqs} className="btn-ghost text-xs py-1 px-2">↻ Refresh</button>
          </div>
          {reqLoading && <LoadingOverlay message="Loading your requests…" />}
          {!reqLoading && reqErr && (
            <div className="px-6 py-10 text-center text-red-500 text-sm">{reqErr}</div>
          )}
          {!reqLoading && myReqs.length === 0 && (
            <div className="px-6 py-14 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-medium">No requests yet</p>
            </div>
          )}
          {!reqLoading && myReqs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-6 py-3">Food</th>
                    <th className="text-left px-6 py-3">Donor</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Delivery</th>
                    <th className="text-left px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {myReqs.map(r => (
                    <tr key={r.request_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-gray-800">
                        {r.food_name}
                        <p className="text-xs text-gray-400 font-normal">{r.food_type} · qty {r.quantity}</p>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">{r.donor_name}</td>
                      <td className="px-6 py-3.5"><StatusBadge status={r.status} /></td>
                      <td className="px-6 py-3.5">
                        {r.delivery_status
                          ? <StatusBadge status={r.delivery_status} />
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{fmt(r.requested_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
