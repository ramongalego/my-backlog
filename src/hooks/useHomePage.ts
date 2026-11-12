'use client';

import { useAuth } from './useAuth';
import { useSyncContext } from '@/components/sync/SyncProvider';
import { useCarouselPools } from './useCarouselPools';
import { useLibraryMeta } from './useLibraryMeta';
import { useHomeActions } from './useHomeActions';

export function useHomePage() {
  const { user, profile, authResolved } = useAuth();
  const sync = useSyncContext();
  const userId = user?.id ?? null;
  const carousels = useCarouselPools(userId);
  const meta = useLibraryMeta(userId);
  const currentGame = useHomeActions(userId);

  // A failed first load is shown as such, rather than as a library with
  // nothing in it (or a skeleton that never resolves).
  const loadError = meta.loadError || currentGame.loadError;
  const isLoading = !authResolved || (!!user && !meta.loaded && !loadError && !sync.isSyncing);

  return {
    auth: {
      user,
      profile,
      isLoading,
    },
    loadError,
    retry: () => {
      if (meta.loadError) meta.retry();
      if (currentGame.loadError) currentGame.retry();
    },
    meta: {
      gameCount: meta.gameCount,
      historyCount: meta.historyCount,
      backlogCount: meta.backlogCount,
      queuedGameIds: currentGame.queuedGameIds,
    },
    sync: {
      isSyncing: sync.isSyncing,
      progress: sync.syncProgress,
      games: sync.syncingGames,
    },
    carousels: {
      pickUp: carousels.pickUp,
      moreLike: carousels.moreLike,
      shortGames: carousels.shortGames,
      weekendGames: carousels.weekendGames,
      highlyRatedGames: carousels.highlyRatedGames,
      hiddenGems: carousels.hiddenGems,
      recentlyAdded: carousels.recentlyAdded,
      loading: carousels.carouselsLoading,
    },
    // The playing game, the queue and every action on them (useHomeActions).
    currentGame,
  };
}
