/**
 * src/pages/donor/DonorDashboard.jsx
 * Full real-time CRUD dashboard for donors.
 * - Lists ALL own food items (any status) via GET /food/my
 * - Incoming requests via GET /food/my/requests
 * - Post food via POST /food/add
 * - Respond to requests via PATCH /requests/:id/respond
 * - Update own food status via PATCH /food/:id/status
 */

import { useState, useMemo, useCallback } from 'react';
import { useAuth }                        from '../../context/AuthContext';
import { useApi, useApiMutation }         from '../../hooks/useApi';
import { LoadingOverlay }                 from '../../components/ui/Spinner';
import StatusBadge                        from '../../components/ui/StatusBadge';
import Modal                              from '../../components/ui/Modal';
import AddFoodForm                        from '../../components/forms/AddFoodForm';
import { Icons }                          from '../../components/ui/Icons';

/* ── helpers ───────────────────────────────────────────────────────────────── */
function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── Stat Card ─────────────────────────────────────────────────────────────── */
function StatCard({ Icon, label, value, color = 'emerald' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue:    'bg-blue-50 text-blue-700 border-blue-100',
    orange:  'bg-orange-50 text-orange-700 border-orange-100',
    purple:  'bg-purple-50 text-purple-700 border-purple-100',
  };
  return (
    <div className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value ?? '—'}</p>
        <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

/* ── Toast ─────────────────────────────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={[
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5',
      'shadow-lg text-sm font-medium animate-fade-in',
      toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white',
    ].join(' ')}>
      {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
    </div>
  );
}

const STATUS_TRANSITIONS = {
  available: ['expired'],
  reserved:  ['donated'],
  donated:   [],
  expired:   [],
};

/* ── Main Component ────────────────────────────────────────────────────────── */
export default function DonorDashboard() {
  const { user }  = useAuth();
  const [tab, setTab]         = useState('listings');   // 'listings' | 'requests'
  const [modalOpen, setModal] = useState(false);
  const [toast, setToast]     = useState(null);
  const { mutate, loading: mutating } = useApiMutation();

  /* ── Data fetching ───────────────────────────────────────────────────── */
  const {
    data: listingsData, loading: listLoading,
    error: listErr, refetch: refetchListings,
  } = useApi('/food/my', { params: { limit: 50 } });

  const {
    data: reqData, loading: reqLoading,
    error: reqErr, refetch: refetchRequests,
  } = useApi('/food/my/requests', { params: { limit: 50 } });

  const listings  = listingsData?.data ?? [];
  const requests  = reqData?.data      ?? [];

  /* ── Stats ───────────────────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    total:     listings.length,
    available: listings.filter(f => f.status === 'available').length,
    donated:   listings.filter(f => f.status === 'donated').length,
    requests:  reqData?.pagination?.total ?? 0,
  }), [listings, reqData]);

  /* ── Toast helper ────────────────────────────────────────────────────── */
  const toast$ = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── Handlers ────────────────────────────────────────────────────────── */
  const handleFoodAdded = (food) => {
    setModal(false);
    toast$(`"${food.food_name}" listed successfully!`);
    refetchListings();
  };

  const handleStatusChange = async (food_id, status, name) => {
    try {
      await mutate('patch', `/food/${food_id}/status`, { status });
      toast$(`"${name}" updated to ${status}`);
      refetchListings();
    } catch {
      toast$('Failed to update status', 'error');
    }
  };

  const handleRespond = async (request_id, action, food_name) => {
    try {
      await mutate('patch', `/requests/${request_id}/respond`, { action });
      toast$(`Request for "${food_name}" ${action}ed`);
      refetchRequests();
      refetchListings();  // food status may change on accept
    } catch (e) {
      toast$(e?.response?.data?.message || 'Failed to respond', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="page-header mb-0">
          <h1 className="page-title">Donor Dashboard</h1>
          <p className="page-sub">Welcome back, {user?.name} 👋</p>
        </div>
        <button
          id="open-add-food-btn"
          onClick={() => setModal(true)}
          className="btn-primary gap-2 flex-shrink-0 flex items-center justify-center shadow-md hover:scale-105 transition-all duration-200"
        >
          <Icons.Plus className="w-4 h-4" />
          <span>Post Food</span>
        </button>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard Icon={Icons.Food}     label="Total Listed"      value={stats.total}     color="blue"   />
        <StatCard Icon={Icons.Dashboard} label="Available Now"     value={stats.available} color="emerald"/>
        <StatCard Icon={Icons.Delivery}  label="Donated"           value={stats.donated}   color="purple" />
        <StatCard Icon={Icons.Requests}  label="Requests Received" value={stats.requests}  color="orange" />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['listings', 'requests'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all',
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {t === 'listings' ? `My Listings (${listings.length})` : `Requests (${requests.length})`}
          </button>
        ))}
      </div>

      {/* ── MY LISTINGS TAB ─────────────────────────────────────────────── */}
      {tab === 'listings' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">All My Food Listings</h2>
            <button onClick={refetchListings} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 hover:text-emerald-700 transition-colors">
              <Icons.Refresh className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
          {listLoading && <LoadingOverlay message="Loading listings…" />}
          {!listLoading && listErr && (
            <div className="px-6 py-10 text-center text-red-500 text-sm">{listErr}</div>
          )}
          {!listLoading && !listErr && listings.length === 0 && (
            <div className="px-6 py-14 text-center">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-gray-500 font-medium">No listings yet</p>
              <p className="text-sm text-gray-400 mt-1">Click <strong>Post Food</strong> to add your first donation.</p>
            </div>
          )}
          {!listLoading && listings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-6 py-3">Food</th>
                    <th className="text-left px-6 py-3">Qty</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Requests</th>
                    <th className="text-left px-6 py-3">Expires</th>
                    <th className="text-left px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {listings.map(food => {
                    const next = STATUS_TRANSITIONS[food.status] ?? [];
                    return (
                      <tr key={food.food_id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-gray-800">{food.food_name}</p>
                          {food.description && (
                            <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{food.description}</p>
                          )}
                          {food.is_flagged === 1 && (
                            <span className="inline-block mt-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                              ⚑ Flagged: {food.flag_reason}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-gray-600">{food.quantity}</td>
                        <td className="px-6 py-3.5"><StatusBadge status={food.status} /></td>
                        <td className="px-6 py-3.5 text-gray-600 font-medium">{food.request_count ?? 0}</td>
                        <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{fmt(food.expiry_time)}</td>
                        <td className="px-6 py-3.5">
                          {next.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {next.map(s => (
                                <button
                                  key={s}
                                  onClick={() => handleStatusChange(food.food_id, s, food.food_name)}
                                  disabled={mutating}
                                  className="btn-secondary text-xs py-1 px-2.5 capitalize"
                                >
                                  Mark {s}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No actions</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── REQUESTS TAB ────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Incoming Requests</h2>
            <button onClick={refetchRequests} className="btn-ghost text-xs py-1 px-2">↻ Refresh</button>
          </div>
          {reqLoading && <LoadingOverlay message="Loading requests…" />}
          {!reqLoading && reqErr && (
            <div className="px-6 py-10 text-center text-red-500 text-sm">{reqErr}</div>
          )}
          {!reqLoading && !reqErr && requests.length === 0 && (
            <div className="px-6 py-14 text-center">
              <p className="text-4xl mb-3">📬</p>
              <p className="text-gray-500 font-medium">No requests yet</p>
              <p className="text-sm text-gray-400 mt-1">Requests from receivers will appear here.</p>
            </div>
          )}
          {!reqLoading && requests.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-6 py-3">Food</th>
                    <th className="text-left px-6 py-3">Receiver</th>
                    <th className="text-left px-6 py-3">Note</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Date</th>
                    <th className="text-left px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map(r => (
                    <tr key={r.request_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-gray-800">{r.food_name}</td>
                      <td className="px-6 py-3.5 text-gray-600">{r.receiver_name}</td>
                      <td className="px-6 py-3.5 text-gray-500 max-w-xs truncate">{r.pickup_note || '—'}</td>
                      <td className="px-6 py-3.5"><StatusBadge status={r.status} /></td>
                      <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{fmt(r.requested_at)}</td>
                      <td className="px-6 py-3.5">
                        {r.status === 'pending' ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleRespond(r.request_id, 'accept', r.food_name)}
                              disabled={mutating}
                              className="btn-primary text-xs py-1 px-2.5"
                            >Accept</button>
                            <button
                              onClick={() => handleRespond(r.request_id, 'reject', r.food_name)}
                              disabled={mutating}
                              className="bg-red-100 hover:bg-red-200 text-red-700 text-xs py-1 px-2.5 rounded-lg font-medium transition-colors"
                            >Reject</button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic capitalize">{r.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Add Food Modal ───────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title="Post a Food Donation" size="lg">
        <AddFoodForm onSuccess={handleFoodAdded} onCancel={() => setModal(false)} />
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
