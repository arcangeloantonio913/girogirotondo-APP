import axios from 'axios';
import { auth } from './firebase';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── Cache in-memory per le GET più frequenti ─────────────────────────────────
// Riduce le chiamate ripetute a endpoint che cambiano raramente
const _cache = new Map();
const CACHE_TTL_MS = 30_000; // 30 secondi

// Solo dati che cambiano raramente — /students escluso (admin lo modifica spesso)
const CACHEABLE_PATHS = ['/classes', '/sedi'];

function cacheKey(url, headers) {
  return `${headers['X-Sede-Id'] || ''}::${url}`;
}
function isCacheable(url) {
  return CACHEABLE_PATHS.some(p => url === p || url.startsWith(p + '?'));
}

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  // 1. Auth token
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken(true);
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      const jwtToken = localStorage.getItem('ggt_token');
      if (jwtToken) config.headers.Authorization = `Bearer ${jwtToken}`;
    }
  } catch { /* procedi senza token */ }

  // 2. Multi-tenant sede header
  const sedeId = localStorage.getItem('ggt_sede');
  if (sedeId) config.headers['X-Sede-Id'] = sedeId;

  // 3. Cache GET per endpoint statici
  if (config.method === 'get' && isCacheable(config.url)) {
    const key  = cacheKey(config.url, config.headers);
    const hit  = _cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      // Ritorna la risposta cached usando adapter custom
      config.adapter = () => Promise.resolve({
        data:    hit.data,
        status:  200,
        headers: {},
        config,
        cached:  true,
      });
    }
  }

  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
let _isLoggingOut = false;

api.interceptors.response.use(
  (res) => {
    // Salva in cache se è una GET cacheabile
    if (res.config?.method === 'get' && !res.cached && isCacheable(res.config.url)) {
      const key = cacheKey(res.config.url, res.config.headers || {});
      _cache.set(key, { data: res.data, ts: Date.now() });
    }
    return res;
  },
  async (err) => {
    if (err.response?.status === 401 && !_isLoggingOut) {
      const detail = err.response?.data?.detail || '';
      const isHard =
        detail.includes('disabilitato') ||
        detail.includes('non trovato') ||
        detail.includes('revocato');
      if (isHard) {
        _isLoggingOut = true;
        localStorage.removeItem('ggt_token');
        localStorage.removeItem('ggt_user');
        try { await auth.signOut(); } catch { /* ignore */ }
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  }
);

// Invalida la cache manualmente (es. dopo una modifica)
api.clearCache = (path) => {
  if (path) {
    for (const key of _cache.keys()) {
      if (key.includes(path)) _cache.delete(key);
    }
  } else {
    _cache.clear();
  }
};

export default api;
