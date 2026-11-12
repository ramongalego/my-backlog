'use client';

import { createContext, useContext, useState } from 'react';
import { useGameSync } from '@/hooks/useGameSync';

type SyncContextValue = ReturnType<typeof useGameSync> & {
  /** Goes up each time a check of the library is asked for. */
  syncCheckRequests: number;
  /**
   * Has LibrarySyncGuard look again for games that need syncing, e.g. after a
   * Steam refresh brought in new ones. It otherwise checks once per page load.
   */
  requestSyncCheck: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const sync = useGameSync();
  const [syncCheckRequests, setSyncCheckRequests] = useState(0);
  const requestSyncCheck = () => setSyncCheckRequests((n) => n + 1);
  return (
    <SyncContext.Provider value={{ ...sync, syncCheckRequests, requestSyncCheck }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return ctx;
}
