import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from './api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'parent' | 'teacher' | 'admin';
  sede_id?: string;
  is_superadmin?: boolean;
  child_id?: string;
  child_ids?: string[];
  class_id?: string;
  class_ids?: string[];
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sede: string;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateSede: (sede: string) => Promise<void>;
  activeChildId: string | null;
  setActiveChildId: (id: string | null) => void;
  childIds: string[];
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sede, setSede]       = useState('girogirotondo');
  const [activeChildId, setActiveChildIdState] = useState<string | null>(null);

  // Carica sessione all'avvio
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('ggt_user');
        const sedeS  = await SecureStore.getItemAsync('ggt_sede');
        const childS = await SecureStore.getItemAsync('ggt_active_child');
        if (stored) setUser(JSON.parse(stored));
        if (sedeS)  setSede(sedeS);
        if (childS) setActiveChildIdState(childS);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, password });
    const token = res.data.token || res.data.access_token;
    const userData: User = res.data.user || res.data;

    await SecureStore.setItemAsync('ggt_token', token);
    await SecureStore.setItemAsync('ggt_user', JSON.stringify(userData));

    if (userData.role === 'admin' && userData.sede_id && !userData.is_superadmin) {
      await SecureStore.setItemAsync('ggt_sede', userData.sede_id);
      setSede(userData.sede_id);
    }

    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('ggt_token');
    await SecureStore.deleteItemAsync('ggt_user');
    await SecureStore.deleteItemAsync('ggt_active_child');
    setUser(null);
    setActiveChildIdState(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const fresh: User = res.data;
      await SecureStore.setItemAsync('ggt_user', JSON.stringify(fresh));
      setUser(fresh);
    } catch {}
  };

  const updateSede = async (newSede: string) => {
    await SecureStore.setItemAsync('ggt_sede', newSede);
    setSede(newSede);
  };

  const setActiveChildId = async (id: string | null) => {
    await SecureStore.setItemAsync('ggt_active_child', id || '');
    setActiveChildIdState(id);
  };

  const childIds = user?.child_ids?.length
    ? user.child_ids
    : user?.child_id ? [user.child_id] : [];

  const resolvedChildId = childIds.includes(activeChildId || '')
    ? activeChildId
    : childIds[0] || null;

  return (
    <AuthContext.Provider value={{
      user, loading, sede, login, logout, refreshUser, updateSede,
      activeChildId: resolvedChildId,
      setActiveChildId,
      childIds,
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
