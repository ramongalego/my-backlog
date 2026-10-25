'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { updateGameStatus } from '@/lib/games/status';
import { RANDOM_PICK_MAX_PLAYTIME_MINUTES } from '@/lib/games/filtering';
import { useInvalidateQueries } from '@/lib/mutations';
import { useNowPlaying } from './useNowPlaying';
import type { GameWithImage } from '@/types/games';
import { scrollBehavior } from '@/lib/motion';

/** Home page: the shared now-playing actions plus carousel detail and random pick. */
export function useCurrentGame(userId: string | null) {
  const nowPlaying = useNowPlaying(userId);
  const { games: invalidateGames } = useInvalidateQueries();
  const [carouselModal, setCarouselModal] = useState<{ game: GameWithImage } | null>(null);

  const handlePickGame = async (game: GameWithImage) => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    await nowPlaying.pick(game);
  };

  const handleConfirmCarouselDetail = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!carouselModal) return;
    const { game } = carouselModal;
    setCarouselModal(null);

    if (status === 'playing') {
      await handlePickGame(game);
      return;
    }

    try {
      await updateGameStatus(game.app_id, status, {
        finishedAt: status === 'finished' ? date : undefined,
        droppedAt: status === 'dropped' ? date : undefined,
        notes,
        rating,
      });
    } catch (err) {
      console.error('Failed to update game status:', err);
      toast.error('Failed to update game status');
    }
    invalidateGames();
  };

  const handleRandomPick = async () => {
    if (!userId || nowPlaying.isStatusLoading) return;

    const supabase = createClient();
    let eligibleGames: GameWithImage[];
    try {
      eligibleGames = await fetchAllRows<GameWithImage>((from, to) =>
        supabase
          .from('games')
          .select('app_id, name, header_image, main_story_hours, playtime_forever')
          .eq('user_id', userId)
          .eq('type', 'game')
          .not('main_story_hours', 'is', null)
          .lte('playtime_forever', RANDOM_PICK_MAX_PLAYTIME_MINUTES)
          .contains('categories', ['Single-player'])
          .or('status.is.null,status.eq.backlog')
          .order('app_id')
          .range(from, to),
      );
    } catch (err) {
      console.error('Failed to load games for random pick:', err);
      toast.error('Could not pick a random game. Please try again.');
      return;
    }

    if (eligibleGames.length === 0) {
      toast.info('No eligible backlog games to pick from.');
      return;
    }

    const randomIndex = Math.floor(Math.random() * eligibleGames.length);
    await handlePickGame(eligibleGames[randomIndex]);
  };

  return {
    currentlyPlaying: nowPlaying.currentlyPlaying,
    queuedAppIds: nowPlaying.queuedAppIds,
    isStatusLoading: nowPlaying.isStatusLoading,
    statusModal: nowPlaying.statusModal,
    gameSummary: nowPlaying.gameSummary,
    carouselModal,
    handlePickGame,
    handleFinishGame: nowPlaying.openFinish,
    handleDropGame: nowPlaying.openDrop,
    handleQueueGame: nowPlaying.addToQueue,
    handleOpenCarouselDetail: (game: GameWithImage) => setCarouselModal({ game }),
    handleConfirmCarouselDetail,
    handleCloseCarouselModal: () => setCarouselModal(null),
    handleConfirmStatusChange: nowPlaying.confirmStatusChange,
    handleCloseStatusModal: nowPlaying.closeStatusModal,
    handleCloseSummary: nowPlaying.closeSummary,
    handleCancelGame: nowPlaying.moveToBacklog,
    handleMoveCurrentToQueue: nowPlaying.moveToQueue,
    handleRandomPick,
  };
}
