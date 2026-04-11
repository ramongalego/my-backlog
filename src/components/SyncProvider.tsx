'use client';

import { createContext, useContext } from 'react';
import { useGameSync } from '@/hooks/useGameSync';

type SyncContextValue = ReturnType<typeof useGameSync>;

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const sync = useGameSync();
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>;
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return ctx;
}
