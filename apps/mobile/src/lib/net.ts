import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** Tracks connectivity so the UI can switch to offline mode (BUILD_BRIEF §M5). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);
  return online;
}
