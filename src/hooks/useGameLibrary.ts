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
  const carousels = useCarouselPools();
  const meta = useLibraryMeta(profile?.steam_id ? (user?.id ?? null) : null);
  const currentGame = useCurrentGame({
    userId: profile?.steam_id ? (user?.id ?? null) : null,
    removeFromPools: carousels.removeFromPools,
    addBackToPool: carousels.addBackToPool,
    addQueuedAppId: meta.addQueuedAppId,
  });

  const steamConnected = !!profile?.steam_id;
  const isLoading = !authResolved || (steamConnected && !meta.loaded && !sync.isSyncing);
  const { refreshIfStale } = useLibraryRefresh();

  // ─── Post-auth initialization: sync check + carousel loading ────────────────

  useEffect(() => {
    if (!authResolved || !user || !steamConnected) return;
    const userId = user.id;
    const supabase = createClient();

    async function checkUnsynced() {
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

    async function loadCarouselPools() {
      const carouselSelect =
        'app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, deck_compat';

      const backlogFilter = 'status.is.null,status.eq.backlog';
      const singlePlayer = ['Single-player'];

      const [
        { data: shortData },
        { data: weekendData },
        { data: highlyRatedData },
        { data: hiddenGemsData },
        { data: recentlyAddedData },
      ] = await Promise.all([
        supabase
          .from('games')
          .select(carouselSelect)
          .eq('user_id', userId)
          .eq('type', 'game')
          .not('main_story_hours', 'is', null)
          .not('steam_review_weighted', 'is', null)
          .gte('main_story_hours', 1)
          .lte('main_story_hours', 5)
          .lte('playtime_forever', 240)
          .contains('categories', singlePlayer)
          .or(backlogFilter)
          .order('steam_review_weighted', { ascending: false }),
        supabase
          .from('games')
          .select(carouselSelect)
          .eq('user_id', userId)
          .eq('type', 'game')
          .not('main_story_hours', 'is', null)
          .not('steam_review_weighted', 'is', null)
          .gt('main_story_hours', 5)
          .lte('main_story_hours', 12)
          .lte('playtime_forever', 240)
          .contains('categories', singlePlayer)
          .or(backlogFilter)
          .order('steam_review_weighted', { ascending: false }),
        supabase
          .from('games')
          .select(carouselSelect)
          .eq('user_id', userId)
          .eq('type', 'game')
          .not('steam_review_weighted', 'is', null)
          .eq('playtime_forever', 0)
          .contains('categories', singlePlayer)
          .or(backlogFilter)
          .order('steam_review_weighted', { ascending: false })
          .limit(20),
        // Hidden Gems: high score, few reviews
        supabase
          .from('games')
          .select(carouselSelect)
          .eq('user_id', userId)
          .eq('type', 'game')
          .gte('steam_review_score', 80)
          .gt('steam_review_count', 10)
          .lte('steam_review_count', 500)
          .contains('categories', singlePlayer)
          .or(backlogFilter)
          .order('steam_review_score', { ascending: false })
          .limit(20),
        // Recently Added (higher app_id = newer Steam release)
        supabase
          .from('games')
          .select(carouselSelect)
          .eq('user_id', userId)
          .eq('type', 'game')
          .contains('categories', singlePlayer)
          .or(backlogFilter)
          .order('app_id', { ascending: false })
          .limit(20),
      ]);

      carousels.setShortGamesPool(shortData || []);
      carousels.setWeekendGamesPool(weekendData || []);
      carousels.setHighlyRatedGamesPool(highlyRatedData || []);
      carousels.setHiddenGemsPool(hiddenGemsData || []);
      carousels.setRecentlyAddedPool(recentlyAddedData || []);
      carousels.setCarouselsLoading(false);
    }

    async function initializeLibrary() {
      await checkUnsynced();
      await loadCarouselPools();
    }

    initializeLibrary();
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
