'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useInvalidateQueries } from '@/hooks/useGameMutations';
import { useSyncContext } from '@/components/sync/SyncProvider';
import { steamPrivateToast } from '@/components/sync/steam-private-toast';
import { useAuth, useUpdateSessionProfile } from './useAuth';

// Playtime is one Steam call for the whole library, so it can be checked often.
const LIBRARY_REFRESH_STALE_MS = 15 * 60 * 1000;
// Review scores cost a call per 50 games and barely move, so once a day.
const REVIEWS_REFRESH_STALE_MS = 24 * 60 * 60 * 1000;

/** Per account: switching accounts in one browser must not inherit the other's timestamps. */
export const refreshKeys = (userId: string | null | undefined) => {
  const suffix = userId ?? 'signed-out';
  return {
    playtime: `playtime_refresh_at:${suffix}`,
    /**
     * The menu's cooldown counts from this, not `playtime`: the background
     * refresh sets that too, which would show Refresh as already used.
     */
    manual: `manual_refresh_at:${suffix}`,
    attempt: `playtime_refresh_attempt_at:${suffix}`,
    reviews: `reviews_refresh_at:${suffix}`,
    /** Set once they've been told Steam is sharing no games, until it shares them again. */
    toldPrivate: `steam_private_told:${suffix}`,
  };
};

/**
 * Null for nothing saved or a time still to come (the clock was wrong): counting
 * from that would hold a refresh back for as long as the clock was out.
 */
function ageOf(key: string): number | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  const age = Date.now() - Number(saved);
  return age >= 0 ? age : null;
}

function isStale(key: string, maxAgeMs: number) {
  const age = ageOf(key);
  return age === null || age > maxAgeMs;
}

/** How long the menu's Refresh library waits after a refresh the player asked for. */
const MANUAL_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

/** What's left of that wait, in milliseconds: 0 when they can refresh again. */
export function manualRefreshWait(userId: string | null | undefined): number {
  const age = ageOf(refreshKeys(userId).manual);
  return age === null ? 0 : Math.max(0, MANUAL_REFRESH_COOLDOWN_MS - age);
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

// Module-level so several mounted callers can't overlap background refreshes:
// a duplicate that finds new games would reload the page mid-sync.
let staleRefreshInFlight: Promise<RefreshResult> | null = null;

export function useLibraryRefresh() {
  const { gamesAndQueue: invalidateGamesAndQueue } = useInvalidateQueries();
  const { user } = useAuth();
  const { requestSyncCheck } = useSyncContext();
  const updateProfile = useUpdateSessionProfile();
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
        // Shown unless the player chose their own name or picture.
        if (data.steamProfile) {
          updateProfile({
            steam_username: data.steamProfile.username,
            steam_avatar: data.steamProfile.avatar,
          });
        }
        // Game details private. A manual refresh says why, and so does the
        // first background one, once, or the library just stops updating. Not
        // recorded as done, so a retry after the setting changes isn't held back.
        if (data.steamPrivate) {
          // Scores and art don't need the library and were still refreshed.
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
          // Asking for the sync check again avoids a reload, which would throw
          // away a half-written note or an open dialog.
          invalidateGamesAndQueue();
          requestSyncCheck();
          if (manual) toast.success(`Added ${newGames} new ${newGames === 1 ? 'game' : 'games'}`);
          return { success: true, newGames, updatedPlaytime };
        }

        // Most refreshes change nothing, and refetching every page's data then is waste.
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
      updateProfile,
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
