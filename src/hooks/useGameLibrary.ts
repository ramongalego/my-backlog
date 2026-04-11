'use client';

import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useSyncContext } from '@/components/SyncProvider';
import { useCarouselPools } from './useCarouselPools';
import { useLibraryMeta } from './useLibraryMeta';
import { useCurrentGame } from './useCurrentGame';
import { useLibraryRefresh } from './useLibraryRefresh';

export function useGameLibrary() {
  const { user, profile, authResolved } = useAuth();
  const sync = useSyncContext();
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

  useEffect(() => {
    if (!authResolved || !user || !steamConnected || sync.isSyncing) return;
    refreshIfStale();
  }, [authResolved, user, steamConnected, sync.isSyncing, refreshIfStale]);

  const handleConnectSteam = () => {
    window.location.href = '/api/steam/auth';
  };

  return {
    auth: {
      user,
      profile,
      isLoading,
    },
    meta: {
      gameCount: meta.gameCount,
      historyCount: meta.historyCount,
      queuedAppIds: meta.queuedAppIds,
    },
    sync: {
      isSyncing: sync.isSyncing,
      progress: sync.syncProgress,
      games: sync.syncingGames,
    },
    carousels: {
      shortGames: carousels.shortGames,
      weekendGames: carousels.weekendGames,
      highlyRatedGames: carousels.highlyRatedGames,
      hiddenGems: carousels.hiddenGems,
      recentlyAdded: carousels.recentlyAdded,
      loading: carousels.carouselsLoading,
    },
    currentGame: {
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
      handleConfirmStatusChange: currentGame.handleConfirmStatusChange,
      handleCloseStatusModal: currentGame.handleCloseStatusModal,
      handleCloseSummary: currentGame.handleCloseSummary,
    },
    handleConnectSteam,
  };
}
