/**
 * src/components/layout/DashboardLayout.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shell layout for all authenticated pages.
 * Composes Sidebar + Navbar + scrollable main content area.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar  from './Navbar';

export default function DashboardLayout() {
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <Navbar
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onToggleMobile={()  => setMobileOpen((v) => !v)}
        />

        {/* Page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
