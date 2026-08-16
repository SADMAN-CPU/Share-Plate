/**
 * src/components/layout/Sidebar.jsx
 * Responsive collapsible sidebar with unified SharePlate green branding.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icons } from '../ui/Icons';
import viteLogo from '../../assets/vite.svg';

/* Nav config per role */
const NAV_ITEMS = {
  donor: [
    { label: 'Dashboard',    to: '/donor/dashboard',  Icon: Icons.Dashboard },
    { label: 'Browse Food',  to: '/food',             Icon: Icons.Food      },
    { label: 'My Listings',  to: '/donor/listings',   Icon: Icons.Requests  },
    { label: 'Requests',     to: '/donor/requests',   Icon: Icons.Delivery  },
  ],
  receiver: [
    { label: 'Browse Map',   to: '/receiver/map',     Icon: Icons.Map       },
    { label: 'My Requests',  to: '/receiver/requests',Icon: Icons.Requests  },
  ],
  volunteer: [
    { label: 'My Tasks',     to: '/volunteer/tasks',  Icon: Icons.Delivery  },
  ],
  admin: [
    { label: 'Admin Panel',  to: '/admin/panel',      Icon: Icons.Dashboard },
    { label: 'Users',        to: '/admin/users',      Icon: Icons.Users     },
    { label: 'Food Items',   to: '/admin/food',       Icon: Icons.Food      },
    { label: 'Deliveries',   to: '/admin/deliveries', Icon: Icons.Delivery  },
  ],
};

export default function Sidebar({ collapsed, mobileOpen, onMobileClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV_ITEMS[user?.role] ?? [];

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  /* Shared link styling with baseline alignment and hover scaling */
  const linkClass = ({ isActive }) =>
    [
      'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 group',
      isActive
        ? 'bg-white text-emerald-900 shadow-sm font-semibold'
        : 'text-emerald-100 hover:bg-white/10 hover:text-white',
    ].join(' ');

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Unified SharePlate Branding Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <img
          src={viteLogo}
          alt="SharePlate Logo"
          className="w-9 h-9 rounded-xl shadow-md flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
        />
        {!collapsed && (
          <span className="text-white font-extrabold text-xl tracking-tight whitespace-nowrap">
            SharePlate
          </span>
        )}
      </div>

      {/* Role Tag */}
      {!collapsed && user && (
        <div className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-800/90 text-emerald-100 rounded-full px-3 py-1 capitalize border border-emerald-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
            {user.role}
          </span>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {items.map(({ label, to, Icon: ItemIcon }) => (
          <NavLink key={to} to={to} className={linkClass} onClick={onMobileClose} title={collapsed ? label : undefined}>
            <ItemIcon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
            {!collapsed && <span className="truncate leading-none">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout Footer */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 text-sm font-medium text-emerald-100 hover:bg-red-500/20 hover:text-red-200 transition-all duration-200 group"
          title={collapsed ? 'Logout' : undefined}
        >
          <Icons.Logout className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
          {!collapsed && <span className="leading-none">Log out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={[
          'hidden lg:flex flex-col flex-shrink-0 bg-emerald-900 transition-all duration-300 ease-in-out shadow-xl z-20',
          collapsed ? 'w-16' : 'w-60',
        ].join(' ')}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onMobileClose} />
          <aside className="relative flex flex-col w-60 bg-emerald-900 z-50 h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
