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
      const token = await currentUser.getIdToken();
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
  // Inviato su tutte le richieste; il backend lo usa solo per le operazioni admin.
  // Teacher e Parent lo ignorano completamente — sicurezza cross-tenant garantita lato server.
  const sedeId = localStorage.getItem('ggt_sede');
  if (sedeId) {
    config.headers['X-Sede-Id'] = sedeId;
  }

  return config;
});

// Prevent multiple concurrent logout redirects
let _isLoggingOut = false;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !_isLoggingOut) {
      _isLoggingOut = true;
      localStorage.removeItem('ggt_token');
      localStorage.removeItem('ggt_user');
      try {
        await auth.signOut();
      } catch {
        // ignore
      }
      window.location.replace('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
