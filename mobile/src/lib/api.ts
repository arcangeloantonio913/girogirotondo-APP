import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { auth } from './firebase';

const BACKEND_URL = 'https://girogirotondo-app-production.up.railway.app';

// Istanza generale (timeout 20s)
const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Istanza per il login (timeout 35s — Railway può essere lento al risveglio)
export const loginApi = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  try {
    const fbUser = auth.currentUser;
    if (fbUser) {
      const t = await fbUser.getIdToken(false);
      config.headers.Authorization = `Bearer ${t}`;
    } else {
      const t = await SecureStore.getItemAsync('ggt_token');
      if (t) config.headers.Authorization = `Bearer ${t}`;
    }
    const sede = await SecureStore.getItemAsync('ggt_sede');
    if (sede) config.headers['X-Sede-Id'] = sede;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const d = err.response?.data?.detail || '';
      if (d.includes('disabilitato') || d.includes('revocato')) {
        await SecureStore.deleteItemAsync('ggt_token');
        await SecureStore.deleteItemAsync('ggt_user');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
