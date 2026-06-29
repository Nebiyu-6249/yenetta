import type { Entitlement, UserProfile } from '@yenetta/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type LoginResponse } from '../lib/api';
import { cacheEntitlement } from '../lib/entitlement-cache';
import { clearTokens, getTokens, setTokens } from '../lib/tokens';

/** Fetches and caches the signed entitlement token for offline gating. */
async function syncEntitlementToken(): Promise<void> {
  try {
    const t = await api.entitlementToken();
    await cacheEntitlement({
      tier: t.entitlement.tier === 'premium' ? 'premium' : 'free',
      token: t.token,
      tokenExpiresAt: t.tokenExpiresAt,
    });
  } catch {
    // Offline or transient — keep the previously cached token.
  }
}

interface AuthState {
  user: UserProfile | null;
  entitlement: Entitlement | null;
  loading: boolean;
  login: (data: LoginResponse) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!(await getTokens())) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        setUser(me.user);
        setEntitlement(me.entitlement);
        void syncEntitlementToken();
      } catch {
        await clearTokens();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (data: LoginResponse) => {
    await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    setEntitlement(data.entitlement);
    void syncEntitlementToken();
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
    setEntitlement(null);
  }, []);

  const value = useMemo(
    () => ({ user, entitlement, loading, login, logout }),
    [user, entitlement, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
