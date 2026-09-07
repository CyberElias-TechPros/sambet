'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean | null; // null = unknown
  login: (email: string, password: string) => Promise<void>;
  setup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.allSettled([api.me(), api.authStatus()]).then(([me, status]) => {
      if (me.status === 'fulfilled') setUser(me.value.user);
      else setUser(null);
      if (status.status === 'fulfilled') setInitialized(status.value.initialized);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.login({ email, password });
    setUser(user);
  }, []);

  const setup = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await api.setup({ name, email, password });
    setUser(user);
    setInitialized(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, initialized, login, setup, logout, refresh }),
    [user, loading, initialized, login, setup, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
