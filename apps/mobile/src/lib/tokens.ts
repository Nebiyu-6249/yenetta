import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS = 'yenetta.access';
const REFRESH = 'yenetta.refresh';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export async function getTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    AsyncStorage.getItem(ACCESS),
    AsyncStorage.getItem(REFRESH),
  ]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export async function setTokens(tokens: Tokens): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS, tokens.accessToken],
    [REFRESH, tokens.refreshToken],
  ]);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS, REFRESH]);
}
