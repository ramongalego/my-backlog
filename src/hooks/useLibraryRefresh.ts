'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useInvalidateQueries } from '@/lib/mutations';
import { reloadPage } from '@/lib/reload';

export const PLAYTIME_REFRESH_KEY = 'playtime_refresh_at';
// Playtime is one Steam call for the whole library, so it can be checked often.
export const LIBRARY_REFRESH_STALE_MS = 15 * 60 * 1000;
const PLAYTIME_ATTEMPT_KEY = 'playtime_refresh_attempt_at';
// Review scores cost a call per 50 games and barely move, so once a day.
const REVIEWS_REFRESH_KEY = 'reviews_refresh_at';
const REVIEWS_REFRESH_STALE_MS = 24 * 60 * 60 * 1000;

function isStale(key: string, maxAgeMs: number) {
  const last = localStorage.getItem(key);
  return !last || Date.now() - Number(last) > maxAgeMs;
}

interface RefreshOptions {
  manual?: boolean;
}

interface RefreshResult {
  success: boolean;
  newGames: number;
  updatedPlaytime: number;
}

const failedResult: RefreshResult = { success: false, newGames: 0, updatedPlaytime: 0 };

// Module-level so several mounted callers (home, queue page) can't fire
// overlapping background refreshes — a duplicate that finds new games would
// reload the page mid-sync.
let staleRefreshInFlight: Promise<RefreshResult> | null = null;

export function useLibraryRefresh() {
  const { gamesAndQueue: invalidateGamesAndQueue } = useInvalidateQueries();

  const refresh = useCallback(
    async (options: RefreshOptions = {}): Promise<RefreshResult> => {
      const { manual = false } = options;

      // A manual refresh brings everything up to date.
      const reviews = manual || isStale(REVIEWS_REFRESH_KEY, REVIEWS_REFRESH_STALE_MS);

      try {
        const res = await fetch('/api/steam/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviews }),
        });
        if (!res.ok) {
          if (manual) toast.error('Failed to refresh library');
          return failedResult;
        }

        const data = await res.json();
        const newGames: number = data.newGames ?? 0;
        const updatedPlaytime: number = data.updatedPlaytime ?? 0;

        localStorage.setItem(PLAYTIME_REFRESH_KEY, Date.now().toString());
        if (reviews) localStorage.setItem(REVIEWS_REFRESH_KEY, Date.now().toString());

        if (newGames > 0) {
          // New games need metadata sync which runs on mount — reload to re-enter that flow.
          reloadPage();
          return { success: true, newGames, updatedPlaytime };
        }

        invalidateGamesAndQueue();

        if (manual) {
          if (updatedPlaytime > 0) {
            toast.success(
              `Updated playtime for ${updatedPlaytime} ${updatedPlaytime === 1 ? 'game' : 'games'}`,
            );
          } else {
            toast.success('Your library is up to date');
          }
        }

        return { success: true, newGames, updatedPlaytime };
      } catch (err) {
        console.error('Failed to refresh library:', err);
        if (manual) toast.error('Failed to refresh library');
        return failedResult;
      }
    },
    [invalidateGamesAndQueue],
  );

  const refreshIfStale = useCallback(async () => {
    if (typeof window === 'undefined' || staleRefreshInFlight) return;
    if (!isStale(PLAYTIME_REFRESH_KEY, LIBRARY_REFRESH_STALE_MS)) return;
    // A failed attempt (rate limited, Steam down) waits the same interval,
    // instead of retrying every time the tab comes back into view.
    if (!isStale(PLAYTIME_ATTEMPT_KEY, LIBRARY_REFRESH_STALE_MS)) return;
    localStorage.setItem(PLAYTIME_ATTEMPT_KEY, Date.now().toString());
    staleRefreshInFlight = refresh().finally(() => {
      staleRefreshInFlight = null;
    });
    await staleRefreshInFlight;
  }, [refresh]);

  return { refresh, refreshIfStale };
}
