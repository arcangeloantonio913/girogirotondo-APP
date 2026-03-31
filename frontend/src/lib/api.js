import axios from 'axios';
import { auth } from './firebase';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Firebase ID token on every request
api.interceptors.request.use(async (config) => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // If Firebase token retrieval fails, proceed without token
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      auth.signOut().catch(() => {});
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
