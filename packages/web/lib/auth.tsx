'use client';

import type { Entitlement, UserProfile } from '@yenetta/shared';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, getTokens, setTokens, type LoginResponse } from './api';

interface AuthState {
  user: UserProfile | null;
  entitlement: Entitlement | null;
  loading: boolean;
  login: (data: LoginResponse) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getTokens()) {
      setUser(null);
      setEntitlement(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setUser(me.user);
      setEntitlement(me.entitlement);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback((data: LoginResponse) => {
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    setEntitlement(data.entitlement);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setEntitlement(null);
  }, []);

  const value = useMemo(
    () => ({ user, entitlement, loading, login, logout, refresh }),
    [user, entitlement, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Redirects to /login when not authenticated; returns auth state for guards. */
export function useRequireAuth(): AuthState {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.replace('/login');
    }
  }, [auth.loading, auth.user, router]);
  return auth;
}
