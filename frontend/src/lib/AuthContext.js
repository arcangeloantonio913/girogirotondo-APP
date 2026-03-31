import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext(null);

const VALID_ROLES = ['admin', 'teacher', 'parent'];

export const SEDI = [
  { id: 'girogirotondo', label: 'Girogirotondo', color: '#4169E1' },
  { id: 'il-magico-mondo', label: 'Il Magico Mondo', color: '#FF69B4' },
];

function buildUserFromProfile(fbUser, data) {
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    ...data,
    role: data.role,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sede, setSede] = useState(
    () => localStorage.getItem('ggt_sede') || 'il-magico-mondo'
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
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
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (!snap.exists) {
      await signOut(auth);
      const err = new Error('NO_PROFILE');
      throw err;
    }
    const data = snap.data();
    if (!VALID_ROLES.includes(data.role)) {
      await signOut(auth);
      const err = new Error('INVALID_ROLE');
      throw err;
    }
    const userData = buildUserFromProfile(cred.user, data);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await signOut(auth);
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
