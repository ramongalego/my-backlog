'use client';

import { useEffect, useRef } from 'react';
import { fetchGamesNeedingSync } from '@/lib/client/sync-candidates';
import { useAuth } from '@/hooks/useAuth';
import { useSyncContext } from './SyncProvider';

export function LibrarySyncGuard() {
  const { user, profile, authResolved } = useAuth();
  const { startSync, isSyncing, syncCheckRequests } = useSyncContext();
  // Once per user per page load, and again whenever a check is asked for.
  const checkedRef = useRef<string | null>(null);

  const steamConnected = !!profile?.steam_id;

  useEffect(() => {
    if (!authResolved || !user || !steamConnected || isSyncing) return;
    const check = `${user.id}:${syncCheckRequests}`;
    if (checkedRef.current === check) return;
    checkedRef.current = check;
    const userId = user.id;

    async function checkUnsynced() {
      const toSync = await fetchGamesNeedingSync(userId);
      if (toSync.length > 0) await startSync(toSync);
    }

    checkUnsynced().catch((err) => console.error('Library sync check failed:', err));
  }, [authResolved, user, steamConnected, isSyncing, startSync, syncCheckRequests]);

  return null;
}
