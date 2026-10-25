'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useInvalidateQueries } from '@/lib/mutations';
import { reloadPage } from '@/lib/reload';
import { useAuth } from './useAuth';

// Playtime is one Steam call for the whole library, so it can be checked often.
export const LIBRARY_REFRESH_STALE_MS = 15 * 60 * 1000;
// Review scores cost a call per 50 games and barely move, so once a day.
const REVIEWS_REFRESH_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * When each kind of refresh last ran, kept per account: switching accounts in
 * the same browser must not inherit the other account's timestamps.
 */
export const refreshKeys = (userId: string | null | undefined) => {
  const suffix = userId ?? 'signed-out';
  return {
    playtime: `playtime_refresh_at:${suffix}`,
    attempt: `playtime_refresh_attempt_at:${suffix}`,
    reviews: `reviews_refresh_at:${suffix}`,
  };
};

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
  const { user } = useAuth();
  const keys = refreshKeys(user?.id);

  const refresh = useCallback(
    async (options: RefreshOptions = {}): Promise<RefreshResult> => {
      const { manual = false } = options;

      // A manual refresh brings everything up to date.
      const reviews = manual || isStale(keys.reviews, REVIEWS_REFRESH_STALE_MS);

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

        localStorage.setItem(keys.playtime, Date.now().toString());
        if (reviews) localStorage.setItem(keys.reviews, Date.now().toString());

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
    [invalidateGamesAndQueue, keys.playtime, keys.reviews],
  );

  const refreshIfStale = useCallback(async () => {
    if (typeof window === 'undefined' || staleRefreshInFlight) return;
    if (!isStale(keys.playtime, LIBRARY_REFRESH_STALE_MS)) return;
    // A failed attempt (rate limited, Steam down) waits the same interval,
    // instead of retrying every time the tab comes back into view.
    if (!isStale(keys.attempt, LIBRARY_REFRESH_STALE_MS)) return;
    localStorage.setItem(keys.attempt, Date.now().toString());
    staleRefreshInFlight = refresh().finally(() => {
      staleRefreshInFlight = null;
    });
    await staleRefreshInFlight;
  }, [refresh, keys.playtime, keys.attempt]);

  return { refresh, refreshIfStale };
}
