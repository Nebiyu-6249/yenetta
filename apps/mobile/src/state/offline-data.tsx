import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useOnline } from '../lib/net';
import {
  DownloadService,
  OfflinePractice,
  OfflineSrs,
  SyncService,
  type OfflineStore,
} from '../lib/offline';
import { SqliteOfflineStore } from '../lib/offline/sqlite-store';

interface OfflineData {
  store: OfflineStore;
  download: DownloadService;
  srs: OfflineSrs;
  practice: OfflinePractice;
  sync: SyncService;
  online: boolean;
  ready: boolean;
  lastSync: number | null;
}

const OfflineContext = createContext<OfflineData | null>(null);

export function OfflineDataProvider({ children }: { children: React.ReactNode }) {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const services = useRef<{
    store: OfflineStore;
    download: DownloadService;
    srs: OfflineSrs;
    practice: OfflinePractice;
    sync: SyncService;
  } | null>(null);

  if (!services.current) {
    const store = new SqliteOfflineStore();
    services.current = {
      store,
      download: new DownloadService(api, store),
      srs: new OfflineSrs(store),
      practice: new OfflinePractice(store),
      sync: new SyncService(api, store),
    };
  }

  useEffect(() => {
    void services.current!.store.init().then(() => setReady(true));
  }, []);

  // Flush queued mutations whenever we come back online.
  useEffect(() => {
    if (online && ready) {
      void services.current!.sync.flush().then((r) => {
        if (r.synced > 0) setLastSync(Date.now());
      });
    }
  }, [online, ready]);

  const value = useMemo<OfflineData>(
    () => ({ ...services.current!, online, ready, lastSync }),
    [online, ready, lastSync],
  );
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineData {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineDataProvider');
  return ctx;
}
