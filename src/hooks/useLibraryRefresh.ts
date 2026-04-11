'use client';

import { useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { toast } from 'sonner';
import { useInvalidateQueries } from '@/lib/mutations';
import { reloadPage } from '@/lib/reload';

export const PLAYTIME_REFRESH_KEY = 'playtime_refresh_at';
export const LIBRARY_REFRESH_STALE_MS = 60 * 60 * 1000;

interface RefreshOptions {
  manual?: boolean;
}

interface RefreshResult {
  success: boolean;
  newGames: number;
  updatedPlaytime: number;
}

const failedResult: RefreshResult = { success: false, newGames: 0, updatedPlaytime: 0 };

export function useLibraryRefresh() {
  const { gamesAndQueue: invalidateGamesAndQueue } = useInvalidateQueries();

  const refresh = useCallback(
    async (options: RefreshOptions = {}): Promise<RefreshResult> => {
      const { manual = false } = options;

      try {
        const res = await fetch('/api/steam/refresh', { method: 'POST' });
        if (!res.ok) {
          if (manual) toast.error('Failed to refresh library');
          return failedResult;
        }

        const data = await res.json();
        const newGames: number = data.newGames ?? 0;
        const updatedPlaytime: number = data.updatedPlaytime ?? 0;

        localStorage.setItem(PLAYTIME_REFRESH_KEY, Date.now().toString());

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
        Sentry.captureException(err);
        console.error('Failed to refresh library:', err);
        if (manual) toast.error('Failed to refresh library');
        return failedResult;
      }
    },
    [invalidateGamesAndQueue],
  );

  const refreshIfStale = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const last = localStorage.getItem(PLAYTIME_REFRESH_KEY);
    if (last && Date.now() - Number(last) <= LIBRARY_REFRESH_STALE_MS) return;
    await refresh();
  }, [refresh]);

  return { refresh, refreshIfStale };
}
