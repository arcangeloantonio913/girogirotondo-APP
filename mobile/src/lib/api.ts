import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BACKEND_URL = 'https://girogirotondo-app-production.up.railway.app';
const API_BASE    = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Allega token + sede header a ogni richiesta
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('ggt_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const sede = await SecureStore.getItemAsync('ggt_sede');
    if (sede) config.headers['X-Sede-Id'] = sede;
  } catch {}
  return config;
});

// Gestione errori — logout solo se sessione esplicitamente revocata
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const detail = err.response?.data?.detail || '';
      if (detail.includes('disabilitato') || detail.includes('revocato')) {
        await SecureStore.deleteItemAsync('ggt_token');
        await SecureStore.deleteItemAsync('ggt_user');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
