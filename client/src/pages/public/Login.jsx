/**
 * src/pages/public/Login.jsx
 * Refactored Login page with green SharePlate branding logo and polished Canva/Figma UI styling.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import viteLogo from '../../assets/vite.svg';

const ROLE_HOME = {
  donor:     '/donor/dashboard',
  receiver:  '/receiver/map',
  volunteer: '/volunteer/tasks',
  admin:     '/admin/panel',
};

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from = location.state?.from?.pathname;

  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token);
      const role = data.user?.role;
      navigate(from ?? ROLE_HOME[role] ?? '/', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error   ||
        (err.code === 'ERR_NETWORK' ? 'Cannot connect to server. Is the backend running?' : null) ||
        'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-3 group transition-transform duration-200 hover:scale-105">
            <img src={viteLogo} alt="SharePlate Logo" className="w-12 h-12 shadow-md rounded-2xl flex-shrink-0" />
            <span className="text-3xl font-extrabold text-emerald-900 tracking-tight">SharePlate</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Sign in to continue food sharing</p>
        </div>

        {/* Card Form Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-6">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium animate-shake">
              {error}
            </div>
          )}

          <form id="login-form" onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-semibold rounded-xl py-3 text-sm shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-sm font-medium text-gray-600">
          Don&rsquo;t have an account?{' '}
          <Link to="/register" className="text-emerald-700 font-bold hover:text-emerald-800 hover:underline transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
