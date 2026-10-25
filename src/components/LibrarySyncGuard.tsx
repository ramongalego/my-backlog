'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { useAuth } from '@/hooks/useAuth';
import type { Game } from '@/types/games';
import { useSyncContext } from './SyncProvider';

type SyncCandidate = Game & { metadata_synced: boolean | null };

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
      // Never-synced games, plus games still missing HLTB hours: the sync
      // endpoints serve those from the shared cache and only re-fetch the ones
      // whose HLTB retry backoff has elapsed.
      const candidates = await fetchAllRows<SyncCandidate>((from, to) =>
        supabase
          .from('games')
          .select('app_id, name, type, categories, metadata_synced')
          .eq('user_id', userId)
          .or(
            'metadata_synced.is.null,metadata_synced.eq.false,and(type.eq.game,main_story_hours.is.null)',
          )
          .order('app_id')
          .range(from, to),
      );

      const toSync = candidates.filter((g) => {
        if (g.type && g.type !== 'game') return false;
        if (g.categories && !g.categories.includes('Single-player')) return false;
        return true;
      });

      if (toSync.length > 0) {
        await startSync(toSync);
      }
    }

    checkUnsynced().catch((err) => console.error('Library sync check failed:', err));
  }, [authResolved, user, steamConnected, isSyncing, startSync]);

  return null;
}
