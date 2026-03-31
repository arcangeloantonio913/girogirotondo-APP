import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBEmCYrCwojyYNyMCH9KOtlQfbkzLVz8hs",
    authDomain: "girogirotondo.firebaseapp.com",
    projectId: "girogirotondo",
    storageBucket: "girogirotondo.firebasestorage.app",
    messagingSenderId: "481357222661",
    appId: "1:481357222661:web:afbfe728a53e2534005d6c",
    measurementId: "G-QFN7H6M6P9"
  };
  

// Inizializza Firebase (evita doppie inizializzazioni in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };