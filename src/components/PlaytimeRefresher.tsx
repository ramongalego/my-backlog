'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLibraryRefresh } from '@/hooks/useLibraryRefresh';
import { useSyncContext } from './SyncProvider';

/**
 * Keeps playtime current on every signed-in page: refreshes from Steam when
 * the app opens and whenever the tab comes back into view, if the last
 * refresh is older than LIBRARY_REFRESH_STALE_MS. So a game played with the
 * app left open in a tab shows its new hours when you come back to it.
 */
export function PlaytimeRefresher() {
  const { user, profile, authResolved } = useAuth();
  const { isSyncing } = useSyncContext();
  const { refreshIfStale } = useLibraryRefresh();
  const ready = authResolved && !!user && !!profile?.steam_id && !isSyncing;

  useEffect(() => {
    if (!ready) return;
    refreshIfStale();

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfStale();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [ready, refreshIfStale]);

  return null;
}
