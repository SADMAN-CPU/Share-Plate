/**
 * src/pages/public/Landing.jsx
 * Public landing page — hero + feature highlights
 */

import { Link } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🥘',
    title: 'Zero Food Waste',
    desc:  'Donors list surplus meals so nothing ends up in the bin.',
  },
  {
    icon: '📍',
    title: 'Local & Fast',
    desc:  'Real-time map connects nearby receivers with donors instantly.',
  },
  {
    icon: '🛡️',
    title: 'Safety First',
    desc:  'Every listing includes a verified food-safety checklist.',
  },
  {
    icon: '🚴',
    title: 'Volunteer Network',
    desc:  'Community volunteers handle pickups so donors don\'t have to.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-semibold text-brand-800 text-lg">
          <span className="text-2xl">🍃</span> Share Plate
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login"    className="btn-ghost text-sm px-4 py-2">Log in</Link>
          <Link to="/register" className="btn-primary text-sm">Get started</Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="text-center px-6 py-24 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-5">
          Share food.{' '}
          <span className="text-brand-700">Change lives.</span>
        </h1>
        <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
          Share Plate connects surplus food donors with people in need —
          bridging hunger gaps through community-powered logistics.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/register" className="btn-primary px-6 py-3 text-base">
            Join as Donor / Receiver
          </Link>
          <Link to="/food" className="btn-secondary px-6 py-3 text-base">
            Browse available food
          </Link>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 text-center mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="card p-6 text-center">
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-brand-900 text-white py-16 text-center px-6">
        <h2 className="text-3xl font-bold mb-4">Ready to make a difference?</h2>
        <p className="text-brand-200 mb-8 max-w-md mx-auto">
          Join thousands of donors, volunteers, and receivers already on the platform.
        </p>
        <Link to="/register" className="btn bg-white text-brand-800 hover:bg-brand-50 px-8 py-3 text-base shadow-sm">
          Create a free account
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="text-center text-sm text-gray-400 py-8">
        © {new Date().getFullYear()} Share Plate. Built with ❤️ to fight food waste.
      </footer>
    </div>
  );
}
