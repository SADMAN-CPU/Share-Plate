/**
 * src/components/ProtectedRoute.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps private routes.
 *
 * Props:
 *   allowedRoles? {string[]} — if supplied, user.role must be in the array.
 *                              If omitted, any authenticated user may access.
 *
 * Behaviour:
 *   • Not logged in   → redirect to /login
 *   • Wrong role      → redirect to their own dashboard
 *   • Authorised      → render <Outlet />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* Maps a role to its home dashboard path */
const ROLE_HOME = {
  donor:     '/donor/dashboard',
  receiver:  '/receiver/map',
  volunteer: '/volunteer/tasks',
  admin:     '/admin/panel',
};

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuth, user } = useAuth();
  const location = useLocation();

  /* Not authenticated — preserve intended destination */
  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  /* Wrong role — redirect to user's own dashboard */
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const home = ROLE_HOME[user?.role] ?? '/';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
