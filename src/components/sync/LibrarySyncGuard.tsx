'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { needsSyncCheck } from '@/lib/games/metadata-cache';
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
      const supabase = createClient();
      // Which games need a look is decided by needsSyncCheck. The query only
      // narrows it down to the ones that could: on an established library
      // that's a handful of rows, where the whole library used to come down on
      // every page load. Release dates are display text, so "recent" is asked
      // for as the two years a date from the last twelve months can contain.
      const year = new Date().getFullYear();
      const couldNeedSync = [
        'metadata_synced.is.null',
        'metadata_synced.eq.false',
        'main_story_hours.is.null',
        `release_date.ilike.*${year}*`,
        `release_date.ilike.*${year - 1}*`,
      ].join(',');
      const games = await fetchAllRows<SyncCandidate>((from, to) =>
        supabase
          .from('games')
          .select(
            'app_id, name, type, categories, header_image, metadata_synced, main_story_hours, release_date',
          )
          .eq('user_id', userId)
          .eq('source', 'steam')
          .or(couldNeedSync)
          .order('app_id')
          .range(from, to),
      );

      const now = Date.now();
      const toSync = games.filter((g) => needsSyncCheck(g, now));

      if (toSync.length > 0) {
        await startSync(toSync);
      }
    }

    checkUnsynced().catch((err) => console.error('Library sync check failed:', err));
  }, [authResolved, user, steamConnected, isSyncing, startSync, syncCheckRequests]);

  return null;
}
