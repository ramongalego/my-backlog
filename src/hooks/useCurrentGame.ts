'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
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

    // Count the eligible games, then fetch only the one at a random position,
    // instead of downloading them all to choose one.
    const supabase = createClient();
    const eligible = (columns: string, options?: { count: 'exact'; head: true }) =>
      supabase
        .from('games')
        .select(columns, options)
        .eq('user_id', userId)
        .eq('type', 'game')
        .not('main_story_hours', 'is', null)
        .lte('playtime_forever', RANDOM_PICK_MAX_PLAYTIME_MINUTES)
        .contains('categories', ['Single-player'])
        .or('status.is.null,status.eq.backlog');

    let picked: GameWithImage | undefined;
    let count: number | null = null;
    try {
      const counted = await eligible('app_id', { count: 'exact', head: true });
      if (counted.error) throw counted.error;
      count = counted.count;
      if (count) {
        const index = Math.floor(Math.random() * count);
        const { data, error } = await eligible(
          'app_id, name, header_image, main_story_hours, playtime_forever',
        )
          .order('app_id')
          .range(index, index);
        if (error) throw error;
        picked = (data as unknown as GameWithImage[] | null)?.[0];
      }
    } catch (err) {
      console.error('Failed to load a game for random pick:', err);
      toast.error('Could not pick a random game. Please try again.');
      return;
    }

    if (!count) {
      toast.info('No eligible backlog games to pick from.');
      return;
    }
    // The library changed between the two requests; asking again is enough.
    if (!picked) {
      toast.error('Could not pick a random game. Please try again.');
      return;
    }
    await handlePickGame(picked);
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
