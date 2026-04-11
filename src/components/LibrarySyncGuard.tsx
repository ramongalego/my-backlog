'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSyncContext } from './SyncProvider';

export function LibrarySyncGuard() {
  const { user, profile, authResolved } = useAuth();
  const { startSync, isSyncing } = useSyncContext();
  const checkedUserIdRef = useRef<string | null>(null);

  const steamConnected = !!profile?.steam_id;

  useEffect(() => {
    if (!authResolved || !user || !steamConnected || isSyncing) return;
    if (checkedUserIdRef.current === user.id) return;
    checkedUserIdRef.current = user.id;
    const userId = user.id;

    async function checkUnsynced() {
      const supabase = createClient();
      const { data: allUnsyncedGames } = await supabase
        .from('games')
        .select('app_id, name, type, categories')
        .eq('user_id', userId)
        .or('metadata_synced.is.null,metadata_synced.eq.false');

      const unsyncedGames = allUnsyncedGames?.filter((g) => {
        if (g.type && g.type !== 'game') return false;
        if (g.categories && !g.categories.includes('Single-player')) return false;
        return true;
      });

      if (unsyncedGames && unsyncedGames.length > 0) {
        await startSync(unsyncedGames);
      }
    }

    checkUnsynced();
  }, [authResolved, user, steamConnected, isSyncing, startSync]);

  return null;
}
