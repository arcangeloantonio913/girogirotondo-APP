import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import axios from 'axios';
import { SEDI as TENANT_SEDI } from '@/config/tenant';

// Import dinamico — evita crash se firebase/messaging non è disponibile
const requestPushPermission = async () => {
  try {
    const mod = await import('./pushNotifications');
    return mod.requestPushPermission();
  } catch { return false; }
};

const AuthContext = createContext(null);

const VALID_ROLES = ['admin', 'teacher', 'parent'];

// Sedi del tenant attivo (branding per-tenant). Ri-esportate qui per retro-compatibilità
// con i componenti che le importano da '@/lib/AuthContext' (es. AppLayout).
export const SEDI = TENANT_SEDI;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function buildUserFromProfile(fbUser, data) {
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    ...data,
    role: data.role,
  };
}

async function loginWithBackend(email, password) {
  const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
  const token = res.data.token || res.data.access_token;
  const user = res.data.user;
  if (!token || !user) throw new Error('Risposta backend non valida');
  if (!VALID_ROLES.includes(user.role)) throw new Error('INVALID_ROLE');
  localStorage.setItem('ggt_token', token);
  localStorage.setItem('ggt_user', JSON.stringify(user));
  return user;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('ggt_user');
    if (storedUser) {
      try { return JSON.parse(storedUser); } catch {
        localStorage.removeItem('ggt_user');
        localStorage.removeItem('ggt_token');
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(() => !localStorage.getItem('ggt_user'));

  // Sede attiva: default = prima sede del tenant (mai hardcoded 'girogirotondo').
  const [sede, setSede] = useState(
    () => localStorage.getItem('ggt_sede') || (SEDI[0] && SEDI[0].id) || 'girogirotondo'
  );

  // Bambino attivo (per famiglie con più figli)
  const [activeChildId, setActiveChildIdState] = useState(
    () => localStorage.getItem('ggt_active_child') || null
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        const hasJwtSession = localStorage.getItem('ggt_token');
        if (!hasJwtSession) {
          localStorage.removeItem('ggt_user');
          setUser(null);
        }
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (!snap.exists()) {
          await signOut(auth);
          localStorage.removeItem('ggt_user');
          setUser(null);
          setLoading(false);
          return;
        }
        const data = snap.data();
        if (!VALID_ROLES.includes(data.role)) {
          await signOut(auth);
          localStorage.removeItem('ggt_user');
          setUser(null);
          setLoading(false);
          return;
        }
        const userData = buildUserFromProfile(fbUser, data);
        localStorage.setItem('ggt_user', JSON.stringify(userData));
        setUser(userData);
      } catch {
        setLoading(false);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        throw new Error('NO_PROFILE');
      }
      const data = snap.data();
      if (!VALID_ROLES.includes(data.role)) {
        await signOut(auth);
        throw new Error('INVALID_ROLE');
      }
      const userData = buildUserFromProfile(cred.user, data);
      localStorage.setItem('ggt_user', JSON.stringify(userData));
      setUser(userData);

      // Imposta sede di default dal profilo utente (admin non-superadmin)
      if (data.role === 'admin' && data.sede_id && !data.is_superadmin) {
        updateSede(data.sede_id);
      }

      // Richiedi permesso notifiche push (non bloccante)
      requestPushPermission().catch(() => {});

      return userData;
    } catch (firebaseErr) {
      const firebaseCodes = ['auth/user-not-found', 'auth/invalid-credential', 'auth/wrong-password'];
      const isFirebaseNotFound =
        firebaseCodes.includes(firebaseErr?.code) ||
        firebaseErr?.message === 'NO_PROFILE';

      if (!isFirebaseNotFound) throw firebaseErr;

      try {
        const userData = await loginWithBackend(email, password);
        setLoading(false);
        setUser(userData);

        // Imposta sede di default dal profilo
        if (userData.role === 'admin' && userData.sede_id && !userData.is_superadmin) {
          updateSede(userData.sede_id);
        }

        // Richiedi permesso notifiche push (non bloccante)
        requestPushPermission().catch(() => {});

        return userData;
      } catch (backendErr) {
        localStorage.removeItem('ggt_token');
        localStorage.removeItem('ggt_user');
        const err = new Error('Email o password non corretti.');
        err.code = 'auth/invalid-credential';
        throw err;
      }
    }
  };

  const logout = async () => {
    await signOut(auth).catch(() => {});
    localStorage.removeItem('ggt_token');
    localStorage.removeItem('ggt_user');
    setUser(null);
  };

  // ── refreshUser: aggiorna il profilo dal backend senza logout ────────────
  // Risolve il problema "devo scollegarmi per vedere i nuovi dati"
  const refreshUser = async () => {
    const token = localStorage.getItem('ggt_token');
    if (!token) return;
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
      const res = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fresh = res.data;
      localStorage.setItem('ggt_user', JSON.stringify(fresh));
      // Evita un re-render dell'intera app se il profilo non è cambiato (focus ripetuti).
      setUser(prev => (JSON.stringify(fresh) === JSON.stringify(prev) ? prev : fresh));
    } catch { /* ignora errori di rete — usa i dati esistenti */ }
  };

  // Auto-refresh quando l'utente torna sulla tab/app (visibilitychange)
  // → i genitori non devono più fare logout/login per vedere dati aggiornati.
  // Throttle a 60s: prima ogni focus lanciava un refresh + svuotava tutta la cache API,
  // vanificando la cache. Ora l'invalidazione avviene solo sulle mutazioni (vedi api.js).
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    const handle = () => {
      if (!document.hidden && user) {
        const now = Date.now();
        if (now - lastRefreshRef.current < 60_000) return;
        lastRefreshRef.current = now;
        refreshUser();
      }
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [user]); // eslint-disable-line

  const updateSede = (sedeId) => {
    localStorage.setItem('ggt_sede', sedeId);
    setSede(sedeId);
  };

  // Garantisce l'header X-Sede-Id per gli admin (api.js lo legge da localStorage 'ggt_sede').
  // I SuperAdmin (le direttrici) NON hanno una sede fissa: senza header, le operazioni
  // per-sede (upload documenti, menu mensa, avvisi...) venivano salvate con sede NULLA e poi
  // sparivano dalle liste (che filtrano per sede) → sembrava "non carica". Persistiamo la sede
  // corrente (default: prima sede del tenant); il superadmin può comunque cambiarla dallo switcher.
  useEffect(() => {
    if (user?.role === 'admin' && !localStorage.getItem('ggt_sede') && sede) {
      updateSede(sede);
    }
  }, [user, sede]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveChildId = (childId) => {
    localStorage.setItem('ggt_active_child', childId || '');
    setActiveChildIdState(childId);
  };

  // Calcola il bambino attivo: usa quello salvato se valido, altrimenti il primo.
  // Memoizzati per dare identità stabile al value del context (evita re-render inutili).
  const childIds = useMemo(() => (
    user?.child_ids?.length ? user.child_ids
      : user?.child_id ? [user.child_id] : []
  ), [user]);
  const resolvedActiveChildId = useMemo(() => (
    childIds.includes(activeChildId) ? activeChildId : childIds[0] || null
  ), [childIds, activeChildId]);

  const sedeInfo = useMemo(() => SEDI.find((s) => s.id === sede) || SEDI[0], [sede]);

  // SuperAdmin: può accedere a entrambe le sedi
  const isSuperAdmin = user?.is_superadmin === true;

  // Memoizza il value per evitare che ogni render del provider faccia ri-renderizzare
  // tutti i consumer di useAuth.
  const value = useMemo(() => ({
    user,
    login,
    logout,
    loading,
    sede,
    sedeInfo,
    updateSede,
    isSuperAdmin,
    activeChildId: resolvedActiveChildId,
    setActiveChildId,
    childIds,
    refreshUser,
  }), [user, loading, sede, sedeInfo, isSuperAdmin, resolvedActiveChildId, childIds]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
