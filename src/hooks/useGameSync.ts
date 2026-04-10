'use client';

import { useState, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { Game, SyncProgress } from '@/types/games';

export function useGameSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0 });
  const [syncingGames, setSyncingGames] = useState<Game[]>([]);
  const syncingRef = useRef(false);

  const startSync = async (games: Game[]) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setSyncingGames(games);
    setSyncProgress({ current: 0, total: games.length });

    const BATCH_SIZE = 6;
    let completed = 0;

    // Step 1: Bulk-resolve cache hits in a single request
    let remainingAppIds: Set<number>;
    try {
      const bulkResponse = await fetch('/api/games/sync/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: games.map((g) => g.app_id) }),
      });

      if (bulkResponse.ok) {
        const bulkData = await bulkResponse.json();
        completed = bulkData.synced;
        setSyncProgress({ current: completed, total: games.length });
        remainingAppIds = new Set(bulkData.remaining as number[]);
      } else {
        remainingAppIds = new Set(games.map((g) => g.app_id));
      }
    } catch {
      remainingAppIds = new Set(games.map((g) => g.app_id));
    }

    // Step 2: Individually sync only cache misses
    const remainingGames = games.filter((g) => remainingAppIds.has(g.app_id));

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
          Sentry.captureException(err);
          console.error(`Failed to sync ${game.name}:`, err);
        }
        break;
      }
      completed++;
      setSyncProgress({ current: completed, total: games.length });
    };

    for (let i = 0; i < remainingGames.length; i += BATCH_SIZE) {
      const batch = remainingGames.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(syncOne));
    }

    setIsSyncing(false);
    setSyncingGames([]);
    syncingRef.current = false;
  };

  return { isSyncing, syncProgress, syncingGames, startSync };
}
