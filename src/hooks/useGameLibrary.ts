'use client';

import { useAuth } from './useAuth';
import { useSyncContext } from '@/components/SyncProvider';
import { useCarouselPools } from './useCarouselPools';
import { useLibraryMeta } from './useLibraryMeta';
import { useCurrentGame } from './useCurrentGame';

export function useGameLibrary() {
  const { user, profile, authResolved } = useAuth();
  const sync = useSyncContext();
  const userId = user?.id ?? null;
  const carousels = useCarouselPools(userId);
  const meta = useLibraryMeta(userId);
  const currentGame = useCurrentGame(userId);

  const isLoading = !authResolved || (!!user && !meta.loaded && !sync.isSyncing);

  return {
    auth: {
      user,
      profile,
      isLoading,
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
    currentGame: {
      currentlyPlaying: currentGame.currentlyPlaying,
      queue: currentGame.queue,
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
      handleMoveCurrentToQueue: currentGame.handleMoveCurrentToQueue,
      handleRandomPick: currentGame.handleRandomPick,
      handleConfirmStatusChange: currentGame.handleConfirmStatusChange,
      handleCloseStatusModal: currentGame.handleCloseStatusModal,
      handleCloseSummary: currentGame.handleCloseSummary,
    },
  };
}
