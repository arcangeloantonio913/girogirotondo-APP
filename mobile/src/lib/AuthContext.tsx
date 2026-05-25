import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db as firestoreDb } from './firebase';
import api, { loginApi } from './api';
import { registerForPushNotifications } from './notifications';

interface User {
  id?: string; uid?: string; name: string; cognome?: string; email: string;
  role: 'parent' | 'teacher' | 'admin';
  sede_id?: string; is_superadmin?: boolean;
  child_id?: string; child_ids?: string[];
  class_id?: string; class_ids?: string[];
  [key: string]: any;
}
interface AuthContextType {
  user: User | null; loading: boolean; sede: string; isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>; refreshUser: () => Promise<void>;
  updateSede: (sede: string) => Promise<void>;
  activeChildId: string | null; setActiveChildId: (id: string | null) => void;
  childIds: string[];
}

const VALID_ROLES = ['admin', 'teacher', 'parent'];
const AuthContext = createContext<AuthContextType | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Login via backend JWT (utenti admin-created, maestre, genitori) */
async function tryBackendLogin(email: string, password: string): Promise<User> {
  const res = await loginApi.post('/auth/login', { email, password });
  const token = res.data.token || res.data.access_token;
  const userData: User = res.data.user;
  if (!token || !userData || !VALID_ROLES.includes(userData.role))
    throw new Error('risposta-non-valida');
  await SecureStore.setItemAsync('ggt_token', token);
  return userData;
}

/** Login via Firebase Auth + Firestore (utenti registrati via webapp) */
async function tryFirebaseLogin(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(firestoreDb, 'users', cred.user.uid));
  if (!snap.exists()) throw new Error('no-firestore-profile');
  const data = snap.data();
  if (!VALID_ROLES.includes(data?.role)) throw new Error('invalid-role');
  const idToken = await cred.user.getIdToken();
  await SecureStore.setItemAsync('ggt_token', idToken);
  return {
    uid: cred.user.uid,
    email: cred.user.email || email,
    ...data,
    role: data.role,
  } as User;
}

/** Salva utente e imposta sede */
async function saveUser(userData: User, setSede: (s: string) => void) {
  await SecureStore.setItemAsync('ggt_user', JSON.stringify(userData));
  if (userData.role === 'admin' && userData.sede_id && !userData.is_superadmin) {
    await SecureStore.setItemAsync('ggt_sede', userData.sede_id);
    setSede(userData.sede_id);
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sede, setSede]       = useState('girogirotondo');
  const [activeChildId, setACI] = useState<string | null>(null);

  // Sessione salvata → accesso istantaneo all'avvio
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('ggt_user');
        const sedeS  = await SecureStore.getItemAsync('ggt_sede');
        const childS = await SecureStore.getItemAsync('ggt_active_child');
        if (stored) setUser(JSON.parse(stored));
        if (sedeS)  setSede(sedeS);
        if (childS) setACI(childS);
      } catch {}
      setLoading(false);
    })();
  }, []);

  // Rinnova token Firebase in background — NON cancella la sessione se Firebase perde lo stato
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        // Firebase ha perso lo stato (hot reload, riavvio app)
        // Non cancellare l'utente se abbiamo ancora un JWT valido
        const hasJwt = await SecureStore.getItemAsync('ggt_token');
        if (!hasJwt) {
          // Solo in questo caso cancella la sessione
          setUser(null);
        }
        return;
      }
      try {
        const t = await fbUser.getIdToken(false);
        await SecureStore.setItemAsync('ggt_token', t);
      } catch {}
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const emailLower = email.trim().toLowerCase();

    // ── Login PARALLELO — backend JWT e Firebase partono insieme ──────────
    // Vince il primo che risponde correttamente. Così:
    // • Se il backend risponde in 1s → accesso in 1s
    // • Se Firebase risponde in 2s e backend è down → accesso in 2s
    // • Se entrambi falliscono → errore immediato

    let userData: User | null = null;
    let backendErr = '';
    let firebaseErr = '';

    const [backendResult, firebaseResult] = await Promise.allSettled([
      tryBackendLogin(emailLower, password),
      tryFirebaseLogin(emailLower, password),
    ]);

    if (backendResult.status === 'fulfilled') {
      userData = backendResult.value;
    } else {
      const e = backendResult.reason;
      backendErr = e?.response?.data?.detail || e?.message || 'errore';
      console.log('[AUTH] Backend:', backendErr.substring(0, 80));
    }

    if (firebaseResult.status === 'fulfilled' && !userData) {
      userData = firebaseResult.value;
    } else if (firebaseResult.status === 'rejected') {
      firebaseErr = firebaseResult.reason?.code || firebaseResult.reason?.message || '';
      console.log('[AUTH] Firebase:', firebaseErr);
    }

    if (!userData) {
      await SecureStore.deleteItemAsync('ggt_token');
      await SecureStore.deleteItemAsync('ggt_user');

      // Messaggio user-friendly in base al tipo di errore
      const isDbDown = backendErr.includes('Connection refused')
        || backendErr.includes('timed out')
        || backendErr.includes('ECONNREFUSED')
        || backendErr.includes('Network Error');
      const isWrongPwd = backendErr.includes('Credenziali non valide')
        || firebaseErr.includes('invalid-credential')
        || firebaseErr.includes('wrong-password');

      if (isDbDown && !isWrongPwd) {
        throw new Error('Servizio temporaneamente non disponibile.\nRiprova tra qualche secondo.');
      }
      throw new Error('Email o password non corretti.\nVerifica le credenziali e riprova.');
    }

    // Login riuscito
    await saveUser(userData, setSede);
    setUser(userData);
    registerForPushNotifications().catch(() => {});
    return userData;
  };

  const logout = async () => {
    await signOut(auth).catch(() => {});
    await SecureStore.deleteItemAsync('ggt_token');
    await SecureStore.deleteItemAsync('ggt_user');
    await SecureStore.deleteItemAsync('ggt_active_child');
    setUser(null); setACI(null);
  };

  const refreshUser = async () => {
    try {
      const fbUser = auth.currentUser;
      if (fbUser) {
        const snap = await getDoc(doc(firestoreDb, 'users', fbUser.uid));
        if (snap.exists()) {
          const fresh: User = { uid: fbUser.uid, email: fbUser.email || '', ...snap.data(), role: snap.data().role };
          await SecureStore.setItemAsync('ggt_user', JSON.stringify(fresh));
          setUser(fresh); return;
        }
      }
      const res = await api.get('/auth/me');
      const fresh: User = res.data;
      await SecureStore.setItemAsync('ggt_user', JSON.stringify(fresh));
      setUser(fresh);
    } catch {}
  };

  const updateSede = async (s: string) => {
    await SecureStore.setItemAsync('ggt_sede', s); setSede(s);
  };
  const setActiveChildId = async (id: string | null) => {
    await SecureStore.setItemAsync('ggt_active_child', id || ''); setACI(id);
  };

  const childIds = user?.child_ids?.length ? user.child_ids : user?.child_id ? [user.child_id] : [];
  const resolvedChildId = childIds.includes(activeChildId || '') ? activeChildId : childIds[0] || null;
  const isSuperAdmin = user?.is_superadmin === true;

  return (
    <AuthContext.Provider value={{
      user, loading, sede, isSuperAdmin, login, logout, refreshUser, updateSede,
      activeChildId: resolvedChildId, setActiveChildId, childIds,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
