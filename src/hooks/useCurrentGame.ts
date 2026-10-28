'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updateGameStatus } from '@/lib/games/status';
import { findRandomBacklogGame, RANDOM_ROLL_MS } from '@/lib/games/random-pick';
import { useInvalidateQueries, usePatchGamesList } from '@/lib/mutations';
import { statusChangeFrom } from '@/lib/games/status-rules';
import { useNowPlaying } from './useNowPlaying';
import type { GameWithImage } from '@/types/games';
import { prefersReducedMotion, scrollBehavior } from '@/lib/motion';
import { queryKeys } from '@/lib/query-keys';
import { backlogCovers, type CarouselPools } from './useCarouselPools';

/** Home page: the shared now-playing actions plus carousel detail and random pick. */
export function useCurrentGame(userId: string | null) {
  const nowPlaying = useNowPlaying(userId);
  const { statusChanged } = useInvalidateQueries();
  const gamesList = usePatchGamesList(userId);
  const queryClient = useQueryClient();
  const [carouselModal, setCarouselModal] = useState<{ game: GameWithImage } | null>(null);
  // While Random picks: the art flicking past. Then the game it picked, whose
  // art comes into focus as it starts playing.
  const [rollCovers, setRollCovers] = useState<string[] | null>(null);
  const [rolledGameId, setRolledGameId] = useState<number | null>(null);

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

    const previous = gamesList.patch(
      statusChangeFrom({ gameId: game.id, status, date, notes, rating }),
    );
    try {
      await updateGameStatus(game.id, status, {
        finishedAt: status === 'finished' ? date : undefined,
        droppedAt: status === 'dropped' ? date : undefined,
        notes,
        rating,
      });
    } catch (err) {
      console.error('Failed to update game status:', err);
      gamesList.restore(previous);
      toast.error('Failed to update game status');
    }
    statusChanged();
  };

  const handleRandomPick = async () => {
    if (!userId || nowPlaying.isStatusLoading || rollCovers) return;

    const covers = prefersReducedMotion()
      ? []
      : backlogCovers(
          queryClient.getQueryData<CarouselPools>(queryKeys.carousels.byUser(userId)),
          nowPlaying.queuedGameIds,
        );
    const rolling = covers.length >= 2;
    if (rolling) setRollCovers(covers);
    const [picked] = await Promise.all([
      findRandomGame(userId),
      rolling ? new Promise((resolve) => setTimeout(resolve, RANDOM_ROLL_MS)) : null,
    ]);
    if (!picked) {
      setRollCovers(null);
      return;
    }
    setRolledGameId(picked.id);
    // Starting it shows it at once (before the server answers), so the roll
    // ends with the game in its place.
    await handlePickGame(picked);
    setRollCovers(null);
  };

  /** A random backlog game to play, or null (having said why). */
  const findRandomGame = async (userId: string): Promise<GameWithImage | null> => {
    const found = await findRandomBacklogGame(createClient(), userId);
    if ('game' in found) return found.game;
    if (found.error === 'none') toast.info('No eligible backlog games to pick from.');
    else toast.error('Could not pick a random game. Please try again.');
    return null;
  };

  return {
    currentlyPlaying: nowPlaying.currentlyPlaying,
    queue: nowPlaying.queue,
    queuedGameIds: nowPlaying.queuedGameIds,
    isStatusLoading: nowPlaying.isStatusLoading,
    loadError: nowPlaying.loadError,
    retry: nowPlaying.retry,
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
    rollCovers,
    rolledGameId,
  };
}
