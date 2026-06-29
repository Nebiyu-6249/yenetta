import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'yenetta.entitlement';

export interface CachedEntitlement {
  tier: 'free' | 'premium';
  token: string;
  tokenExpiresAt: string;
}

/** Caches the signed entitlement token so premium gating works offline. */
export async function cacheEntitlement(value: CachedEntitlement): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}

export async function readCachedEntitlement(): Promise<CachedEntitlement | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as CachedEntitlement) : null;
}

/** Offline premium check: cached token must say premium AND not be expired. */
export function isPremiumOffline(cached: CachedEntitlement | null): boolean {
  return Boolean(
    cached && cached.tier === 'premium' && new Date(cached.tokenExpiresAt).getTime() > Date.now(),
  );
}
