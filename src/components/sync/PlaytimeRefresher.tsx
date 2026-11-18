'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLibraryRefresh } from '@/hooks/useLibraryRefresh';
import { useSyncContext } from './SyncProvider';

/**
 * On every signed-in page: refreshes from Steam on open and when the tab comes
 * back into view, once LIBRARY_REFRESH_STALE_MS has passed since the last one.
 */
export function PlaytimeRefresher() {
  const { user, authResolved } = useAuth();
  const { isSyncing } = useSyncContext();
  const { refreshIfStale } = useLibraryRefresh();
  const ready = authResolved && !!user && !isSyncing;

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
