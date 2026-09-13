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

// Istanza per il login (timeout 35s — Railway può essere lento al risveglio a freddo)
export const loginApi = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
});

// Registry per il logout forzato — evita cicli di import (api.ts NON importa AuthContext).
// L'AuthContext registra qui il proprio logout; l'interceptor lo invoca su revoca/disabilitazione.
let onForcedLogout: (() => void) | null = null;
export function setForcedLogoutHandler(fn: (() => void) | null) {
  onForcedLogout = fn;
}

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
      // Il login usa loginApi (istanza separata, senza questo interceptor): un 401 su `api`
      // significa SEMPRE che il token della sessione salvata è stato rifiutato — account
      // disabilitato/revocato (messaggio esplicito), token scaduto o non valido (messaggio
      // generico). Prima si ripuliva solo su "disabilitato/revocato" → utente disabilitato o
      // token scaduto restava "loggato" con sessione rotta (401 a catena, schermate vuote).
      // Ora: se c'era una sessione, la si chiude e si torna al Login.
      try {
        const hadToken = await SecureStore.getItemAsync('ggt_token');
        if (hadToken) {
          await SecureStore.deleteItemAsync('ggt_token');
          await SecureStore.deleteItemAsync('ggt_user');
          // Sincronizza lo stato React in memoria: senza questo l'app resta montata
          // con user popolato ma token assente → 401 a catena / schermate vuote.
          onForcedLogout?.();
        }
      } catch {}
    }
    return Promise.reject(err);
  }
);

export default api;
