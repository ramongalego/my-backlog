'use client';

import { useState, useRef } from 'react';
import { useInvalidateQueries } from '@/lib/mutations';
import { chunk } from '@/lib/supabase/paginate';
import { MAX_BULK_APP_IDS } from '@/lib/validations/common';
import type { Game, SyncProgress } from '@/types/games';

const BATCH_SIZE = 6;

// Resolves cache hits in bulk and returns the app_ids that still need an
// individual upstream fetch. A failed chunk counts all of its ids as remaining.
async function resolveFromCache(
  games: Game[],
): Promise<{ resolved: number; synced: number; remaining: Set<number> }> {
  let resolved = 0;
  let synced = 0;
  const remaining = new Set<number>();
  for (const ids of chunk(
    games.map((g) => g.app_id),
    MAX_BULK_APP_IDS,
  )) {
    try {
      const res = await fetch('/api/games/sync/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: ids }),
      });
      if (!res.ok) throw new Error(`Bulk sync failed (${res.status})`);
      const data = await res.json();
      resolved += data.resolved;
      synced += data.synced;
      for (const id of data.remaining as number[]) remaining.add(id);
    } catch (err) {
      console.error(err);
      for (const id of ids) remaining.add(id);
    }
  }
  return { resolved, synced, remaining };
}

export function useGameSync() {
  const { gamesAndQueue: invalidateGameData } = useInvalidateQueries();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0 });
  const [syncingGames, setSyncingGames] = useState<Game[]>([]);
  const syncingRef = useRef(false);

  const startSync = async (games: Game[]) => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      // Step 1: cache hits, silently. The progress UI (which replaces the
      // dashboard) only appears when there's real upstream fetching to do.
      const { resolved, synced, remaining } = await resolveFromCache(games);
      const remainingGames = games.filter((g) => remaining.has(g.app_id));
      if (remainingGames.length === 0) {
        // Only refetch when the cache actually changed something.
        if (synced > 0) invalidateGameData();
        return;
      }

      let completed = resolved;
      setIsSyncing(true);
      setSyncingGames(games);
      setSyncProgress({ current: completed, total: games.length });

      // Step 2: individually sync only cache misses
      const syncOne = async (game: Game): Promise<void> => {
        let attempts = 0;
        while (attempts < 5) {
          try {
            const response = await fetch('/api/games/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appId: game.app_id, name: game.name }),
            });
            if (response.status === 429) {
              const retryAfter = Math.min(
                parseInt(response.headers.get('Retry-After') ?? '10', 10),
                15,
              );
              await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
              attempts++;
              continue;
            }
          } catch (err) {
            console.error(`Failed to sync ${game.name}:`, err);
          }
          break;
        }
        completed++;
        setSyncProgress({ current: completed, total: games.length });
      };

      for (const batch of chunk(remainingGames, BATCH_SIZE)) {
        await Promise.all(batch.map(syncOne));
      }

      // Carousels, counts and lists were loaded before the metadata existed.
      invalidateGameData();
    } finally {
      setIsSyncing(false);
      setSyncingGames([]);
      syncingRef.current = false;
    }
  };

  return { isSyncing, syncProgress, syncingGames, startSync };
}
