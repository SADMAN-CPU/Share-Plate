
import Landing   from './pages/public/Landing';
import Login     from './pages/public/Login';
import Register  from './pages/public/Register';

/* Donor pages */
import DonorDashboard   from './pages/donor/DonorDashboard';

/* Receiver pages */
import ReceiverMap from './pages/receiver/ReceiverMap';

/* Volunteer pages */
import VolunteerTasks from './pages/volunteer/VolunteerTasks';

/* Admin pages */
import AdminPanel from './pages/admin/AdminPanel';
 

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <span className="text-6xl mb-4">🍽️</span>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-6">The page you're looking for doesn't exist.</p>
      <a href="/" className="btn-primary">Back to home</a>
    </div>
  );
}

/* ── Router ───────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <Routes>
      {/* ── Public ──────────────────────────────────────────────────── */}
      <Route path="/"         element={<Landing  />} />
      <Route path="/login"    element={<Login    />} />
      <Route path="/register" element={<Register />} />

      {/* ── Protected — with DashboardLayout shell ───────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>

          {/* ── Donor ──────────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['donor']} />}>
            <Route path="/donor/dashboard" element={<DonorDashboard />} />
            {/* Placeholder routes — fill in as phases progress */}
            <Route path="/donor/listings"  element={<div className="page-title">My Listings — coming soon</div>} />
            <Route path="/donor/requests"  element={<div className="page-title">Incoming Requests — coming soon</div>} />
          </Route>

          {/* ── Receiver ───────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['receiver']} />}>
            <Route path="/receiver/map"      element={<ReceiverMap />} />
            <Route path="/receiver/requests" element={<div className="page-title">My Requests — coming soon</div>} />
          </Route>

          {/* ── Volunteer ──────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['volunteer']} />}>
            <Route path="/volunteer/tasks" element={<VolunteerTasks />} />
          </Route>

          {/* ── Admin ──────────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/panel"      element={<AdminPanel />} />
            <Route path="/admin/users"      element={<div className="page-title">Users — coming soon</div>} />
            <Route path="/admin/food"       element={<div className="page-title">Food Items — coming soon</div>} />
            <Route path="/admin/deliveries" element={<div className="page-title">Deliveries — coming soon</div>} />
          </Route>

        </Route>
      </Route>

      {/* ── Catch-all ───────────────────────────────────────────────── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
