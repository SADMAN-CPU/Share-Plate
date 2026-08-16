/**
 * src/pages/admin/AdminPanel.jsx
 * Admin control panel — full real-time CRUD from MySQL.
 *
 * Tabs:
 *  1. Overview  — live stats from GET /admin/stats
 *  2. Users     — GET /admin/users, verify/ban/activate via PUT /admin/users/:id/status
 *  3. Listings  — GET /admin/food,  flag/expire via admin endpoints
 *  4. Deliveries— GET /admin/deliveries, assign volunteer via PATCH /deliveries/:id/assign
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth }                           from '../../context/AuthContext';
import { useApi, useApiMutation }            from '../../hooks/useApi';
import { LoadingOverlay }                    from '../../components/ui/Spinner';
import StatusBadge                           from '../../components/ui/StatusBadge';
import { Icons }                              from '../../components/ui/Icons';
import api                                   from '../../api/axios';

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

/* ── Stat Box ──────────────────────────────────────────────────────────────── */
function StatBox({ label, value, sub, emoji, color = 'emerald' }) {
  const colors = {
    emerald: 'border-emerald-200 bg-emerald-50',
    blue:    'border-blue-200   bg-blue-50',
    orange:  'border-orange-200 bg-orange-50',
    purple:  'border-purple-200 bg-purple-50',
    red:     'border-red-200    bg-red-50',
  };
  return (
    <div className={`rounded-xl border p-5 flex items-center gap-4 ${colors[color]}`}>
      <span className="text-3xl">{emoji}</span>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value ?? '—'}</p>
        <p className="text-sm text-gray-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────────── */
export default function AdminPanel() {
  const { user }  = useAuth();
  const [tab, setTab]   = useState('overview');
  const [toast, setToast] = useState(null);
  const { mutate, loading: mutating } = useApiMutation();

  /* ── Filter states ───────────────────────────────────────────────────── */
  const [userRole, setUserRole]   = useState('');
  const [userVerified, setUserVer] = useState('');
  const [foodStatus, setFoodStatus] = useState('');
  const [delivStatus, setDelivStatus] = useState('');

  /* ── Volunteer list for assignment ───────────────────────────────────── */
  const { data: volData } = useApi('/admin/users', {
    params: { role: 'volunteer', is_verified: 1, limit: 100 },
  });
  const volunteers = volData?.data ?? [];

  /* ── Data fetching ───────────────────────────────────────────────────── */
  const {
    data: statsData, loading: statsLoading, refetch: refetchStats,
  } = useApi('/admin/stats');

  const {
    data: usersData, loading: usersLoading, error: usersErr, refetch: refetchUsers,
  } = useApi('/admin/users', {
    params: {
      role:        userRole     || undefined,
      is_verified: userVerified !== '' ? userVerified : undefined,
      limit: 100,
    },
  });

  const {
    data: foodData, loading: foodLoading, error: foodErr, refetch: refetchFood,
  } = useApi('/admin/food', {
    params: { status: foodStatus || undefined, limit: 100 },
  });

  const {
    data: delivData, loading: delivLoading, error: delivErr, refetch: refetchDeliv,
  } = useApi('/admin/deliveries', {
    params: { status: delivStatus || undefined, limit: 100 },
  });

  const stats     = statsData?.data     ?? {};
  const users     = usersData?.data     ?? [];
  const foods     = foodData?.data      ?? [];
  const deliveries = delivData?.data    ?? [];

  /* ── Toast helper ────────────────────────────────────────────────────── */
  const toast$ = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── User: verify / ban / activate ──────────────────────────────────── */
  const handleUserStatus = async (user_id, status) => {
    try {
      await mutate('put', `/admin/users/${user_id}/status`, { status });
      toast$(`User status updated to "${status}"`);
      refetchUsers();
      refetchStats();
    } catch (e) {
      toast$(e?.response?.data?.message || 'Failed', 'error');
    }
  };

  /* ── Food: flag / expire ─────────────────────────────────────────────── */
  const handleFlagFood = async (food_id, is_flagged, reason = '') => {
    try {
      await mutate('patch', `/admin/food/${food_id}/flag`, { is_flagged, flag_reason: reason });
      toast$(is_flagged ? 'Listing flagged' : 'Flag removed');
      refetchFood();
    } catch (e) {
      toast$(e?.response?.data?.message || 'Failed', 'error');
    }
  };

  const handleExpireFood = async (food_id) => {
    try {
      await mutate('patch', `/admin/food/${food_id}/expire`, {});
      toast$('Listing expired');
      refetchFood();
      refetchStats();
    } catch (e) {
      toast$(e?.response?.data?.message || 'Failed', 'error');
    }
  };

  /* ── Delivery: assign volunteer ──────────────────────────────────────── */
  const handleAssign = async (delivery_id, volunteer_id) => {
    if (!volunteer_id) return;
    try {
      await mutate('patch', `/deliveries/${delivery_id}/assign`, { volunteer_id: Number(volunteer_id) });
      toast$('Volunteer assigned successfully');
      refetchDeliv();
    } catch (e) {
      toast$(e?.response?.data?.message || 'Failed', 'error');
    }
  };

  const TABS = [
    { key: 'overview',    label: '📊 Overview'   },
    { key: 'users',       label: `👥 Users (${usersData?.pagination?.total ?? '…'})`       },
    { key: 'listings',    label: `🍽️ Listings (${foodData?.pagination?.total ?? '…'})`    },
    { key: 'deliveries',  label: `🚴 Deliveries (${delivData?.pagination?.total ?? '…'})` },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="page-header mb-0">
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-sub">Platform control centre — {user?.name}</p>
        </div>
        <button
          onClick={() => { refetchStats(); refetchUsers(); refetchFood(); refetchDeliv(); }}
          className="btn-ghost text-sm py-2 px-4 flex items-center gap-1.5 hover:text-emerald-700 transition-colors"
        >
          <Icons.Refresh className="w-4 h-4" />
          <span>Refresh All</span>
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {statsLoading && <LoadingOverlay message="Loading stats…" />}
          {!statsLoading && (
            <>
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Users</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatBox emoji="👥" label="Total Users"    value={stats.users?.total_users}     color="blue"   />
                  <StatBox emoji="✅" label="Verified"       value={stats.users?.verified_users}  color="emerald"/>
                  <StatBox emoji="⏳" label="Pending"        value={stats.users?.pending_users}   color="orange" />
                  <StatBox emoji="🚫" label="Banned"         value={stats.users?.banned_users}    color="red"    />
                </div>
              </div>
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Food Listings</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatBox emoji="📦" label="Total"     value={stats.food?.total_listings}     color="blue"   />
                  <StatBox emoji="🟢" label="Available" value={stats.food?.available_listings} color="emerald"/>
                  <StatBox emoji="🔒" label="Reserved"  value={stats.food?.reserved_listings}  color="orange" />
                  <StatBox emoji="✔️" label="Donated"   value={stats.food?.donated_listings}   color="purple" />
                </div>
              </div>
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Deliveries</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatBox emoji="🚴" label="Total"     value={stats.deliveries?.total_deliveries}     color="blue"   />
                  <StatBox emoji="📌" label="Assigned"  value={stats.deliveries?.assigned_deliveries}  color="orange" />
                  <StatBox emoji="🚗" label="Picked Up" value={stats.deliveries?.pickedup_deliveries}  color="purple" />
                  <StatBox emoji="✅" label="Delivered"  value={stats.deliveries?.delivered_deliveries} color="emerald"/>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── USERS ───────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="card overflow-hidden">
          {/* Filters */}
          <div className="flex gap-3 px-6 py-4 border-b border-gray-100 flex-wrap items-center">
            <h2 className="text-base font-semibold text-gray-800 mr-auto">All Users</h2>
            <select value={userRole} onChange={e => setUserRole(e.target.value)} className="input-field text-sm w-auto py-1.5">
              <option value="">All Roles</option>
              {['admin','donor','receiver','volunteer'].map(r => (
                <option key={r} value={r} className="capitalize">{r}</option>
              ))}
            </select>
            <select value={userVerified} onChange={e => setUserVer(e.target.value)} className="input-field text-sm w-auto py-1.5">
              <option value="">All Verified</option>
              <option value="1">Verified</option>
              <option value="0">Pending</option>
            </select>
            <button onClick={refetchUsers} className="btn-ghost text-xs py-1 px-2">↻</button>
          </div>

          {usersLoading && <LoadingOverlay message="Loading users…" />}
          {!usersLoading && usersErr && (
            <div className="px-6 py-10 text-center text-red-500 text-sm">{usersErr}</div>
          )}
          {!usersLoading && users.length === 0 && (
            <div className="px-6 py-14 text-center text-gray-400">No users found</div>
          )}
          {!usersLoading && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-6 py-3">Email</th>
                    <th className="text-left px-6 py-3">Role</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Joined</th>
                    <th className="text-left px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr key={u.user_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-gray-800">{u.name}</p>
                        {u.location && <p className="text-xs text-gray-400">{u.location}</p>}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">{u.email}</td>
                      <td className="px-6 py-3.5">
                        <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full capitalize font-medium">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-3.5"><StatusBadge status={u.status} /></td>
                      <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{fmt(u.created_at)}</td>
                      <td className="px-6 py-3.5">
                        {u.role !== 'admin' && (
                          <div className="flex flex-wrap gap-1.5">
                            {u.status !== 'active' && (
                              <button
                                onClick={() => handleUserStatus(u.user_id, 'active')}
                                disabled={mutating}
                                className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-1 px-2.5 rounded-lg font-medium transition-colors"
                              >Activate</button>
                            )}
                            {u.status !== 'banned' && (
                              <button
                                onClick={() => handleUserStatus(u.user_id, 'banned')}
                                disabled={mutating}
                                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 py-1 px-2.5 rounded-lg font-medium transition-colors"
                              >Ban</button>
                            )}
                            {u.status !== 'suspended' && (
                              <button
                                onClick={() => handleUserStatus(u.user_id, 'suspended')}
                                disabled={mutating}
                                className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 py-1 px-2.5 rounded-lg font-medium transition-colors"
                              >Suspend</button>
                            )}
                          </div>
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

      {/* ── LISTINGS ────────────────────────────────────────────────────── */}
      {tab === 'listings' && (
        <div className="card overflow-hidden">
          <div className="flex gap-3 px-6 py-4 border-b border-gray-100 flex-wrap items-center">
            <h2 className="text-base font-semibold text-gray-800 mr-auto">Food Listings</h2>
            <select value={foodStatus} onChange={e => setFoodStatus(e.target.value)} className="input-field text-sm w-auto py-1.5">
              <option value="">All Statuses</option>
              {['available','reserved','donated','expired'].map(s => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
            <button onClick={refetchFood} className="btn-ghost text-xs py-1 px-2">↻</button>
          </div>

          {foodLoading && <LoadingOverlay message="Loading listings…" />}
          {!foodLoading && foodErr && (
            <div className="px-6 py-10 text-center text-red-500 text-sm">{foodErr}</div>
          )}
          {!foodLoading && foods.length === 0 && (
            <div className="px-6 py-14 text-center text-gray-400">No listings found</div>
          )}
          {!foodLoading && foods.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-6 py-3">Food</th>
                    <th className="text-left px-6 py-3">Donor</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Flagged</th>
                    <th className="text-left px-6 py-3">Posted</th>
                    <th className="text-left px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {foods.map(f => (
                    <tr key={f.food_id} className={['hover:bg-gray-50/60 transition-colors', f.is_flagged ? 'bg-red-50/40' : ''].join(' ')}>
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-gray-800">{f.food_name}</p>
                        <p className="text-xs text-gray-400">{f.food_type} · qty {f.quantity}</p>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">{f.donor_name}</td>
                      <td className="px-6 py-3.5"><StatusBadge status={f.status} /></td>
                      <td className="px-6 py-3.5">
                        {f.is_flagged
                          ? <span className="text-xs text-red-600 font-medium">⚑ {f.flag_reason || 'Yes'}</span>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{fmt(f.created_at)}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {f.status !== 'expired' && (
                            <button
                              onClick={() => handleExpireFood(f.food_id)}
                              disabled={mutating}
                              className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 py-1 px-2.5 rounded-lg font-medium transition-colors"
                            >Expire</button>
                          )}
                          {f.is_flagged ? (
                            <button
                              onClick={() => handleFlagFood(f.food_id, false)}
                              disabled={mutating}
                              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2.5 rounded-lg font-medium transition-colors"
                            >Unflag</button>
                          ) : (
                            <button
                              onClick={() => handleFlagFood(f.food_id, true, 'Admin review')}
                              disabled={mutating}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 py-1 px-2.5 rounded-lg font-medium transition-colors"
                            >Flag</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DELIVERIES ──────────────────────────────────────────────────── */}
      {tab === 'deliveries' && (
        <div className="card overflow-hidden">
          <div className="flex gap-3 px-6 py-4 border-b border-gray-100 flex-wrap items-center">
            <h2 className="text-base font-semibold text-gray-800 mr-auto">All Deliveries</h2>
            <select value={delivStatus} onChange={e => setDelivStatus(e.target.value)} className="input-field text-sm w-auto py-1.5">
              <option value="">All Statuses</option>
              {['assigned','picked_up','delivered','failed'].map(s => (
                <option key={s} value={s}>{s.replace('_',' ')}</option>
              ))}
            </select>
            <button onClick={refetchDeliv} className="btn-ghost text-xs py-1 px-2">↻</button>
          </div>

          {delivLoading && <LoadingOverlay message="Loading deliveries…" />}
          {!delivLoading && delivErr && (
            <div className="px-6 py-10 text-center text-red-500 text-sm">{delivErr}</div>
          )}
          {!delivLoading && deliveries.length === 0 && (
            <div className="px-6 py-14 text-center text-gray-400">No deliveries found</div>
          )}
          {!delivLoading && deliveries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-6 py-3">Food</th>
                    <th className="text-left px-6 py-3">Donor</th>
                    <th className="text-left px-6 py-3">Receiver</th>
                    <th className="text-left px-6 py-3">Volunteer</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Assign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {deliveries.map(d => (
                    <tr key={d.delivery_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-gray-800">{d.food_name}</td>
                      <td className="px-6 py-3.5 text-gray-600">{d.donor_name}</td>
                      <td className="px-6 py-3.5 text-gray-600">{d.receiver_name}</td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {d.volunteer_name || <span className="text-gray-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-6 py-3.5"><StatusBadge status={d.status} /></td>
                      <td className="px-6 py-3.5">
                        {d.status === 'assigned' ? (
                          <select
                            defaultValue=""
                            onChange={e => handleAssign(d.delivery_id, e.target.value)}
                            className="input-field text-xs py-1.5 w-auto"
                          >
                            <option value="" disabled>Select volunteer</option>
                            {volunteers.map(v => (
                              <option key={v.user_id} value={v.user_id}>{v.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
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

      <Toast toast={toast} />
    </div>
  );
}
