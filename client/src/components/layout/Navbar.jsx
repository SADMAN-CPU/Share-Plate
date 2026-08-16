/**
 * src/components/layout/Navbar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Top navigation bar with custom icons and responsive controls.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../ui/NotificationBell';
import { Icons } from '../ui/Icons';

/* Derives a human-readable page title from the pathname */
function usePageTitle() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return 'Home';
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' › ');
}

/* Avatar initials from user name */
function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Navbar({ onToggleSidebar, onToggleMobile, collapsed }) {
  const { user, logout } = useAuth();
  const title = usePageTitle();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e) => { if (!dropRef.current?.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="flex-shrink-0 h-16 bg-white border-b border-gray-100 flex items-center px-6 gap-4 z-10 shadow-xs">
      {/* Mobile Hamburger */}
      <button
        id="mobile-menu-btn"
        onClick={onToggleMobile}
        className="lg:hidden btn-ghost p-2 rounded-xl text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all duration-200"
        aria-label="Open menu"
      >
        <Icons.Menu className="w-5 h-5" />
      </button>

      {/* Desktop Collapse Toggle */}
      <button
        id="sidebar-collapse-btn"
        onClick={onToggleSidebar}
        className="hidden lg:flex btn-ghost p-2 rounded-xl text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all duration-200"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <Icons.Expand className="w-5 h-5" /> : <Icons.Collapse className="w-5 h-5" />}
      </button>

      {/* Page Title with Breadcrumb Styling */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-base font-semibold text-gray-800 tracking-tight">{title}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <NotificationBell />

        {/* User Dropdown Toggle */}
        <div className="relative" ref={dropRef}>
          <button
            id="user-menu-btn"
            onClick={() => setDropOpen((v) => !v)}
            className="flex items-center gap-3 rounded-xl p-1.5 pr-3 hover:bg-gray-50 transition-all duration-200 group border border-transparent hover:border-gray-200"
            aria-expanded={dropOpen}
            aria-haspopup="true"
          >
            {/* Custom Styled Avatar */}
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-200">
              {initials(user?.name)}
            </span>

            {/* User Info */}
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-sm font-semibold text-gray-900 max-w-[130px] truncate">
                {user?.name}
              </span>
              <span className="text-xs font-medium text-emerald-600 capitalize">{user?.role}</span>
            </div>

            {/* Chevron Icon */}
            <Icons.ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropOpen ? 'rotate-180 text-emerald-600' : 'group-hover:text-gray-600'}`}
            />
          </button>

          {/* Dropdown Menu */}
          {dropOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs font-medium text-emerald-600 capitalize">{user?.role} Account</p>
              </div>

              <button
                id="logout-btn"
                onClick={() => { setDropOpen(false); logout(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors group"
              >
                <Icons.Logout className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform duration-200" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
