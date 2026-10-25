'use client';

import { useAuth } from './useAuth';
import { useSyncContext } from '@/components/SyncProvider';
import { useCarouselPools } from './useCarouselPools';
import { useLibraryMeta } from './useLibraryMeta';
import { useCurrentGame } from './useCurrentGame';

export function useGameLibrary() {
  const { user, profile, authResolved } = useAuth();
  const sync = useSyncContext();
  const scopedUserId = profile?.steam_id ? (user?.id ?? null) : null;
  const carousels = useCarouselPools(scopedUserId);
  const meta = useLibraryMeta(scopedUserId);
  const currentGame = useCurrentGame(scopedUserId);

  const steamConnected = !!profile?.steam_id;
  const isLoading = !authResolved || (steamConnected && !meta.loaded && !sync.isSyncing);

  const handleConnectSteam = () => {
    // Full-page navigation is intentional: this route handler 307s to steamcommunity.com
    // (OpenID), which a client-side router.push() cannot follow.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
      queuedAppIds: currentGame.queuedAppIds,
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
    handleConnectSteam,
  };
}
