import axios from 'axios';
import { auth } from './firebase';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token on every request (Firebase ID token or backend JWT fallback)
api.interceptors.request.use(async (config) => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Fallback: use stored JWT from backend login (demo users)
      const jwtToken = localStorage.getItem('ggt_token');
      if (jwtToken) {
        config.headers.Authorization = `Bearer ${jwtToken}`;
      }
    }
  } catch {
    // If token retrieval fails, proceed without token
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
      // Clear all stored session data BEFORE signing out
      localStorage.removeItem('ggt_token');
      localStorage.removeItem('ggt_user');
      // Wait for signOut to fully complete (clears Firebase IndexedDB persistence)
      // so onAuthStateChanged doesn't re-login automatically on page load
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
