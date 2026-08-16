/**
 * src/context/AuthContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global auth state via React Context.
 *
 * Provides:
 *   user      — decoded JWT payload { sub, name, role } or null
 *   token     — raw JWT string or null
 *   login()   — stores token + user in localStorage, updates context
 *   logout()  — clears storage, redirects to /login
 *   isAuth    — boolean convenience flag
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

/* ── helpers ──────────────────────────────────────────────────────────────── */
function parseUser(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function loadFromStorage() {
  const token = localStorage.getItem('sp_token');
  return { token, user: parseUser(token) };
}

/* ── Provider ─────────────────────────────────────────────────────────────── */
export function AuthProvider({ children }) {
  const [{ token, user }, setAuth] = useState(loadFromStorage);
  const navigate = useNavigate();

  const login = useCallback((newToken) => {
    localStorage.setItem('sp_token', newToken);
    const newUser = parseUser(newToken);
    localStorage.setItem('sp_user', JSON.stringify(newUser));
    setAuth({ token: newToken, user: newUser });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_user');
    setAuth({ token: null, user: null });
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ token, user, isAuth: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
