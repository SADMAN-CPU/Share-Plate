/**
 * src/pages/public/Register.jsx
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const ROLES = ['donor', 'receiver', 'volunteer'];

export default function Register() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role: 'receiver', location: '',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.token);
      const roleHome = { donor: '/donor/dashboard', receiver: '/receiver/map', volunteer: '/volunteer/tasks' };
      navigate(roleHome[form.role] ?? '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-brand-800 font-semibold text-xl">
            <span className="text-3xl">🍃</span> Share Plate
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">Join the community — it&apos;s free</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <form id="register-form" onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="form-group">
              <label htmlFor="name" className="label">Full name</label>
              <input id="name" name="name" type="text" required className="input"
                placeholder="Sadman Shaid" value={form.name} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="reg-email" className="label">Email address</label>
              <input id="reg-email" name="email" type="email" required className="input"
                placeholder="you@example.com" value={form.email} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="phone" className="label">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <input id="phone" name="phone" type="tel" className="input"
                placeholder="+880 1XXXXXXXXX" value={form.phone} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="location" className="label">Location</label>
              <input id="location" name="location" type="text" className="input"
                placeholder="Dhaka, Bangladesh" value={form.location} onChange={handleChange} />
            </div>

            {/* Role selector */}
            <div className="form-group">
              <label className="label">I am a…</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r}
                    className={[
                      'flex flex-col items-center justify-center rounded-lg border py-3 cursor-pointer',
                      'text-sm font-medium transition-colors capitalize',
                      form.role === r
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    ].join(' ')}
                  >
                    <input type="radio" name="role" value={r} className="sr-only"
                      checked={form.role === r} onChange={handleChange} />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-password" className="label">Password</label>
              <input id="reg-password" name="password" type="password" required className="input"
                placeholder="Min. 8 characters" value={form.password} onChange={handleChange} />
            </div>

            <button
              id="register-submit-btn"
              type="submit"
              className="btn-primary w-full py-2.5 mt-2"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-700 font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
