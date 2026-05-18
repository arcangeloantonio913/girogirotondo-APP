import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import axios from 'axios';

// Import dinamico — evita crash se firebase/messaging non è disponibile
const requestPushPermission = async () => {
  try {
    const mod = await import('./pushNotifications');
    return mod.requestPushPermission();
  } catch { return false; }
};

const AuthContext = createContext(null);

const VALID_ROLES = ['admin', 'teacher', 'parent'];

export const SEDI = [
  { id: 'girogirotondo',  label: 'Girogirotondo',    color: '#4169E1' },
  { id: 'il-magico-mondo', label: 'Il Magico Mondo', color: '#FF69B4' },
];

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

  // Sede attiva: default "girogirotondo"
  const [sede, setSede] = useState(
    () => localStorage.getItem('ggt_sede') || 'girogirotondo'
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
      setUser(fresh);
    } catch { /* ignora errori di rete — usa i dati esistenti */ }
  };

  // Auto-refresh quando l'utente torna sulla tab/app (visibilitychange)
  // → i genitori non devono più fare logout/login per vedere dati aggiornati
  useEffect(() => {
    const handle = () => {
      if (!document.hidden && user) {
        refreshUser();
        // Invalida anche la cache API per dati freschi
        import('./api').then(({ default: api }) => api.clearCache?.()).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [user]); // eslint-disable-line

  const updateSede = (sedeId) => {
    localStorage.setItem('ggt_sede', sedeId);
    setSede(sedeId);
  };

  const setActiveChildId = (childId) => {
    localStorage.setItem('ggt_active_child', childId || '');
    setActiveChildIdState(childId);
  };

  // Calcola il bambino attivo: usa quello salvato se valido, altrimenti il primo
  const childIds = user?.child_ids?.length ? user.child_ids
    : user?.child_id ? [user.child_id] : [];
  const resolvedActiveChildId = childIds.includes(activeChildId)
    ? activeChildId
    : childIds[0] || null;

  const sedeInfo = SEDI.find((s) => s.id === sede) || SEDI[0];

  // SuperAdmin: può accedere a entrambe le sedi
  const isSuperAdmin = user?.is_superadmin === true;

  return (
    <AuthContext.Provider value={{
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
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
