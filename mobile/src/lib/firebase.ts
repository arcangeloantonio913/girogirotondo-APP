import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Le chiavi Firebase client-side sono pubbliche per design (vedi Firebase docs).
const firebaseConfig = {
  apiKey: 'AIzaSyBEmCYrCwojyYNyMCH9KOtlQfbkzLVz8hs',
  authDomain: 'girogirotondo.firebaseapp.com',
  projectId: 'girogirotondo',
  storageBucket: 'girogirotondo.firebasestorage.app',
  messagingSenderId: '481357222661',
  appId: '1:481357222661:web:afbfe728a53e2534005d6c',
};

// Usa getApp() se già inizializzato (hot reload sicuro)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// getAuth è idempotente — non lancia errori su hot reload
// La persistenza della sessione è gestita da SecureStore in AuthContext
const auth = getAuth(app);

const db = getFirestore(app);

export { app, auth, db };
