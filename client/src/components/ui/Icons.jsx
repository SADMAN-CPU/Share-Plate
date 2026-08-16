/**
 * client/src/components/ui/Icons.jsx
 * High-quality custom SVG icons design system for SharePlate.
 */

import React from 'react';

const baseProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const Icons = {
  // Brand Logo Icon
  Logo: ({ className = 'w-6 h-6' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" fillOpacity="0.2"/>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
    </svg>
  ),

  // Navigation & Structure
  Dashboard: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <rect x="3" y="3" width="7" height="9" rx="2" fill="currentColor" fillOpacity="0.1" />
      <rect x="14" y="3" width="7" height="5" rx="2" fill="currentColor" fillOpacity="0.1" />
      <rect x="14" y="12" width="7" height="9" rx="2" fill="currentColor" fillOpacity="0.1" />
      <rect x="3" y="16" width="7" height="5" rx="2" fill="currentColor" fillOpacity="0.1" />
    </svg>
  ),

  Food: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M12 2a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9s-9-4.03-9-9a9 9 0 0 1 9-9z" fill="currentColor" fillOpacity="0.1"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),

  Requests: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor" fillOpacity="0.1"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),

  Map: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" fill="currentColor" fillOpacity="0.1"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  ),

  Delivery: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <rect x="1" y="3" width="15" height="13" rx="2" fill="currentColor" fillOpacity="0.1"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" fill="currentColor" fillOpacity="0.1"/>
      <circle cx="5.5" cy="18.5" r="2.5" fill="currentColor"/>
      <circle cx="18.5" cy="18.5" r="2.5" fill="currentColor"/>
    </svg>
  ),

  Users: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="currentColor" fillOpacity="0.1"/>
      <circle cx="9" cy="7" r="4" fill="currentColor" fillOpacity="0.1"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),

  Logout: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),

  Menu: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),

  Collapse: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.1"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <path d="m14 15-3-3 3-3"/>
    </svg>
  ),

  Expand: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.1"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <path d="m12 9 3 3-3 3"/>
    </svg>
  ),

  Bell: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="currentColor" fillOpacity="0.1"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),

  Plus: ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),

  Refresh: ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),

  ChevronDown: ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),

  Search: ({ className = 'w-4 h-4' }) => (
    <svg viewBox="0 0 24 24" className={className} {...baseProps}>
      <circle cx="11" cy="11" r="8" fill="currentColor" fillOpacity="0.1"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
};

export default Icons;
