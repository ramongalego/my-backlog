'use client';

import { useState, useRef } from 'react';
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

    const BATCH_SIZE = 3;
    let completed = 0;

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

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(syncOne));
    }

    setIsSyncing(false);
    setSyncingGames([]);
    syncingRef.current = false;
  };

  return { isSyncing, syncProgress, syncingGames, startSync };
}
