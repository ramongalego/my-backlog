'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useInvalidateQueries } from '@/hooks/useGameMutations';
import { useSyncContext } from '@/components/sync/SyncProvider';
import { steamPrivateToast } from '@/components/sync/steam-private-toast';
import { useAuth } from './useAuth';

// Playtime is one Steam call for the whole library, so it can be checked often.
const LIBRARY_REFRESH_STALE_MS = 15 * 60 * 1000;
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
    /**
     * The last refresh the player asked for, which the menu's cooldown counts
     * from. Not `playtime`: that's set by the background refresh too, and a
     * page loaded just after one would show Refresh as already used.
     */
    manual: `manual_refresh_at:${suffix}`,
    attempt: `playtime_refresh_attempt_at:${suffix}`,
    reviews: `reviews_refresh_at:${suffix}`,
    /** Set once they've been told Steam is sharing no games, until it shares them again. */
    toldPrivate: `steam_private_told:${suffix}`,
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
  const { requestSyncCheck } = useSyncContext();
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
        // Steam shared no library (game details private). Not "up to date":
        // a refresh you asked for says why. So does the first one in the
        // background to find it, once: a profile made private after joining
        // otherwise just stops updating, with nothing to say why. It isn't
        // recorded as done either, so trying again once the setting is
        // changed isn't held back.
        if (data.steamPrivate) {
          // The scores and art were still refreshed (they don't need the
          // library), so those wait their day as usual: a profile that went
          // private later would otherwise have them checked on every visit.
          if (reviews) localStorage.setItem(keys.reviews, Date.now().toString());
          if (manual || !localStorage.getItem(keys.toldPrivate)) steamPrivateToast();
          localStorage.setItem(keys.toldPrivate, Date.now().toString());
          return failedResult;
        }
        // Steam is sharing the library: if it stops again, that's news again.
        localStorage.removeItem(keys.toldPrivate);
        const newGames: number = data.newGames ?? 0;
        const updatedPlaytime: number = data.updatedPlaytime ?? 0;

        localStorage.setItem(keys.playtime, Date.now().toString());
        if (manual) localStorage.setItem(keys.manual, Date.now().toString());
        if (reviews) localStorage.setItem(keys.reviews, Date.now().toString());

        if (newGames > 0) {
          // New games need their details synced. That check otherwise runs once
          // per page load; asking for it again does the job without a reload,
          // which would throw away a half-written note or an open dialog.
          invalidateGamesAndQueue();
          requestSyncCheck();
          if (manual) toast.success(`Added ${newGames} new ${newGames === 1 ? 'game' : 'games'}`);
          return { success: true, newGames, updatedPlaytime };
        }

        // Most refreshes change nothing (you haven't played since the last one),
        // and refetching every page's data then would be pure waste.
        const changed =
          (data.updatedGames ?? updatedPlaytime) > 0 ||
          (data.updatedStoreData ?? 0) > 0 ||
          // A hand-added game's time to beat was found or has moved.
          (data.updatedHours ?? 0) > 0;
        if (changed) invalidateGamesAndQueue();

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
    [
      invalidateGamesAndQueue,
      requestSyncCheck,
      keys.playtime,
      keys.manual,
      keys.reviews,
      keys.toldPrivate,
    ],
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
