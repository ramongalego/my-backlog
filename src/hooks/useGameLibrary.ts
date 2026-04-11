'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { useGameSync } from './useGameSync';
import { useCarouselPools } from './useCarouselPools';
import { useLibraryMeta } from './useLibraryMeta';
import { useCurrentGame } from './useCurrentGame';
import { useLibraryRefresh } from './useLibraryRefresh';

export function useGameLibrary() {
  const { user, profile, authResolved } = useAuth();
  const sync = useGameSync();
  const scopedUserId = profile?.steam_id ? (user?.id ?? null) : null;
  const carousels = useCarouselPools(scopedUserId);
  const meta = useLibraryMeta(scopedUserId);
  const currentGame = useCurrentGame({
    userId: scopedUserId,
    removeFromPools: carousels.removeFromPools,
    addBackToPool: carousels.addBackToPool,
    addQueuedAppId: meta.addQueuedAppId,
  });

  const steamConnected = !!profile?.steam_id;
  const isLoading = !authResolved || (steamConnected && !meta.loaded && !sync.isSyncing);
  const { refreshIfStale } = useLibraryRefresh();

  // ─── Check for unsynced games and kick off metadata sync ────────────────────

  useEffect(() => {
    if (!authResolved || !user || !steamConnected) return;
    const userId = user.id;

    async function checkUnsynced() {
      const supabase = createClient();
      const { data: allUnsyncedGames } = await supabase
        .from('games')
        .select('app_id, name, type, categories')
        .eq('user_id', userId)
        .or('metadata_synced.is.null,metadata_synced.eq.false');

      const unsyncedGames = allUnsyncedGames?.filter((g) => {
        if (g.type && g.type !== 'game') return false;
        if (g.categories && !g.categories.includes('Single-player')) return false;
        return true;
      });

      if (unsyncedGames && unsyncedGames.length > 0) {
        await sync.startSync(unsyncedGames);
      }
    }

    checkUnsynced();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, user?.id, steamConnected]);

  // ─── Auto-refresh playtime if stale ─────────────────────────────────────────

  useEffect(() => {
    if (!authResolved || !user || !steamConnected || sync.isSyncing) return;
    refreshIfStale();
  }, [authResolved, user, steamConnected, sync.isSyncing, refreshIfStale]);

  const handleConnectSteam = () => {
    window.location.href = '/api/steam/auth';
  };

  return {
    // Auth
    user,
    profile,
    isLoading,

    // Library meta
    gameCount: meta.gameCount,
    historyCount: meta.historyCount,
    queuedAppIds: meta.queuedAppIds,

    // Sync
    isSyncing: sync.isSyncing,
    syncProgress: sync.syncProgress,
    syncingGames: sync.syncingGames,

    // Carousels
    shortGames: carousels.shortGames,
    weekendGames: carousels.weekendGames,
    highlyRatedGames: carousels.highlyRatedGames,
    hiddenGems: carousels.hiddenGems,
    recentlyAdded: carousels.recentlyAdded,
    carouselsLoading: carousels.carouselsLoading,

    // Current game + actions
    currentlyPlaying: currentGame.currentlyPlaying,
    isStatusLoading: currentGame.isStatusLoading,
    statusModal: currentGame.statusModal,
    gameSummary: currentGame.gameSummary,
    carouselModal: currentGame.carouselModal,
    handlePickGame: currentGame.handlePickGame,
    handleFinishGame: currentGame.handleFinishGame,
    handleDropGame: currentGame.handleDropGame,
    handleQueueGame: currentGame.handleQueueGame,
    handleOpenCarouselDetail: currentGame.handleOpenCarouselDetail,
    handleConfirmCarouselDetail: currentGame.handleConfirmCarouselDetail,
    handleCloseCarouselModal: currentGame.handleCloseCarouselModal,
    handleCancelGame: currentGame.handleCancelGame,
    handleRandomPick: currentGame.handleRandomPick,
    handleConnectSteam,
    handleConfirmStatusChange: currentGame.handleConfirmStatusChange,
    handleCloseStatusModal: currentGame.handleCloseStatusModal,
    handleCloseSummary: currentGame.handleCloseSummary,
  };
}
