/**
 * src/api/axios.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized Axios instance.
 *
 * Features:
 *  • Base URL read from VITE_API_URL env variable (falls back to localhost)
 *  • Request interceptor — attaches Authorization: Bearer <token> automatically
 *  • Response interceptor — on 401, clears storage and redirects to /login
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/* ── Request interceptor — attach JWT ─────────────────────────────────────── */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/* ── Response interceptor — handle 401 globally ──────────────────────────── */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.startsWith('/auth/');
    // Only force-logout on 401 from PROTECTED routes, not from login/register itself
    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('sp_token');
      localStorage.removeItem('sp_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);


export default api;
