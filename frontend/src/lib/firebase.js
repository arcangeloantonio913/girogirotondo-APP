import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Le chiavi Firebase lato client sono PUBBLICHE per design Firebase (vedere Firebase docs).
// SICUREZZA: le chiavi API client-side di Firebase non danno accesso diretto al DB.
// L'accesso è protetto da Firebase Security Rules + backend JWT.
// I fallback hardcoded sono necessari per il funzionamento in produzione quando
// le variabili d'ambiente non sono configurate.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBEmCYrCwojyYNyMCH9KOtlQfbkzLVz8hs",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "girogirotondo.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "girogirotondo",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "girogirotondo.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "481357222661",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:481357222661:web:afbfe728a53e2534005d6c",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-QFN7H6M6P9"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
