import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import axios from 'axios';

const AuthContext = createContext(null);

const VALID_ROLES = ['admin', 'teacher', 'parent'];

export const SEDI = [
  { id: 'girogirotondo', label: 'Girogirotondo', color: '#4169E1' },
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

// JWT-based login against backend (fallback when Firebase user doesn't exist)
async function loginWithBackend(email, password) {
  const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
  const { access_token, user } = res.data;
  if (!access_token || !user) throw new Error('Risposta backend non valida');
  if (!VALID_ROLES.includes(user.role)) throw new Error('INVALID_ROLE');
  localStorage.setItem('ggt_token', access_token);
  localStorage.setItem('ggt_user', JSON.stringify(user));
  return user;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sede, setSede] = useState(
    () => localStorage.getItem('ggt_sede') || 'il-magico-mondo'
  );

  useEffect(() => {
    // Check for stored JWT user (backend fallback session)
    const storedUser = localStorage.getItem('ggt_user');
    const storedToken = localStorage.getItem('ggt_token');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('ggt_user');
        localStorage.removeItem('ggt_token');
      }
    }

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        // Don't clear user if we have a backend JWT session
        const hasJwtSession = localStorage.getItem('ggt_token');
        if (!hasJwtSession) {
          setUser(null);
        }
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (!snap.exists) {
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }
        const data = snap.data();
        if (!VALID_ROLES.includes(data.role)) {
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }
        setUser(buildUserFromProfile(fbUser, data));
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    // Try Firebase first
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists) {
        await signOut(auth);
        throw new Error('NO_PROFILE');
      }
      const data = snap.data();
      if (!VALID_ROLES.includes(data.role)) {
        await signOut(auth);
        throw new Error('INVALID_ROLE');
      }
      const userData = buildUserFromProfile(cred.user, data);
      setUser(userData);
      return userData;
    } catch (firebaseErr) {
      // Firebase user not found or wrong password — try backend JWT fallback
      const firebaseCodes = ['auth/user-not-found', 'auth/invalid-credential', 'auth/wrong-password'];
      const isFirebaseNotFound =
        firebaseCodes.includes(firebaseErr?.code) ||
        firebaseErr?.message === 'NO_PROFILE';

      if (!isFirebaseNotFound) throw firebaseErr; // re-throw real errors (network, etc.)

      try {
        const userData = await loginWithBackend(email, password);
        setLoading(false);
        setUser(userData);
        return userData;
      } catch (backendErr) {
        // Clear any stale JWT
        localStorage.removeItem('ggt_token');
        localStorage.removeItem('ggt_user');
        // Throw a Firebase-style error so the UI shows the right message
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

  const updateSede = (sedeId) => {
    localStorage.setItem('ggt_sede', sedeId);
    setSede(sedeId);
  };

  const sedeInfo = SEDI.find((s) => s.id === sede) || SEDI[1];

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, sede, sedeInfo, updateSede }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
