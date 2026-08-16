/**
 * src/hooks/useApi.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generic data-fetching hook backed by the centralised Axios instance.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi('/food/available', { params: { page: 1 } });
 *
 * Returns:
 *   data      — response payload (null until first successful fetch)
 *   loading   — true while a request is in flight
 *   error     — error message string or null
 *   refetch   — function to manually re-trigger the request
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

export function useApi(url, axiosConfig = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Stable ref so effect dependency stays shallow
  const configRef = useRef(axiosConfig);
  configRef.current = axiosConfig;

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, configRef.current);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * useApiMutation — wraps POST/PUT/PATCH/DELETE calls with loading + error state.
 *
 * Usage:
 *   const { mutate, loading, error } = useApiMutation();
 *   const result = await mutate('post', '/food/add', payload);
 */
export function useApiMutation() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const mutate = useCallback(async (method, url, data, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api[method](url, data, config);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message
               ?? err.response?.data?.error
               ?? err.message
               ?? 'Something went wrong';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error, clearError: () => setError(null) };
}
