import axios from 'axios';
import { auth } from './firebase';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token + sede header on every request
api.interceptors.request.use(async (config) => {
  // 1. Auth token (Firebase o JWT fallback)
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Firebase: getIdToken(true) forza il refresh automatico del token
      const token = await currentUser.getIdToken(true);
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      const jwtToken = localStorage.getItem('ggt_token');
      if (jwtToken) {
        config.headers.Authorization = `Bearer ${jwtToken}`;
      }
    }
  } catch {
    // Se il recupero del token fallisce, procedi senza token
  }

  // 2. Multi-tenant: X-Sede-Id header
  const sedeId = localStorage.getItem('ggt_sede');
  if (sedeId) {
    config.headers['X-Sede-Id'] = sedeId;
  }

  return config;
});

// Gestione errori — NON fare logout automatico su 401
// (il token dura 10 anni, quindi un 401 è probabilmente un errore di rete,
//  non una sessione scaduta)
let _isLoggingOut = false;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // Logout automatico SOLO se la sessione è esplicitamente terminata
    // (es. utente disabilitato) — non su ogni 401 generica
    if (err.response?.status === 401 && !_isLoggingOut) {
      const detail = err.response?.data?.detail || '';
      const isHardLogout =
        detail.includes('disabilitato') ||
        detail.includes('non trovato') ||
        detail.includes('revocato');

      if (isHardLogout) {
        _isLoggingOut = true;
        localStorage.removeItem('ggt_token');
        localStorage.removeItem('ggt_user');
        try { await auth.signOut(); } catch { /* ignore */ }
        window.location.replace('/login');
      }
      // Per tutti gli altri 401: non fare logout, lascia l'utente loggato
    }
    return Promise.reject(err);
  }
);

export default api;
