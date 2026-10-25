'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { isRecentRelease } from '@/lib/games/metadata-cache';
import { useAuth } from '@/hooks/useAuth';
import type { Game } from '@/types/games';
import { useSyncContext } from './SyncProvider';

type SyncCandidate = Game & {
  metadata_synced: boolean | null;
  main_story_hours: number | null;
  release_date: string | null;
};

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
      // Never-synced games, games still missing HLTB hours, and recent
      // releases (whose HLTB times are still settling). The sync endpoints
      // serve these from the shared cache and only re-fetch upstream when a
      // retry or monthly refresh is due. Release dates are display text, so
      // recency is checked here rather than in the query.
      const games = await fetchAllRows<SyncCandidate>((from, to) =>
        supabase
          .from('games')
          .select('app_id, name, type, categories, metadata_synced, main_story_hours, release_date')
          .eq('user_id', userId)
          .order('app_id')
          .range(from, to),
      );

      const now = Date.now();
      const toSync = games.filter((g) => {
        if (g.type && g.type !== 'game') return false;
        if (g.categories && !g.categories.includes('Single-player')) return false;
        return (
          !g.metadata_synced || g.main_story_hours === null || isRecentRelease(g.release_date, now)
        );
      });

      if (toSync.length > 0) {
        await startSync(toSync);
      }
    }

    checkUnsynced().catch((err) => console.error('Library sync check failed:', err));
  }, [authResolved, user, steamConnected, isSyncing, startSync]);

  return null;
}
