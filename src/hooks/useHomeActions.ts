'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { findRandomBacklogGame, RANDOM_ROLL_MS } from '@/lib/client/random-pick';
import { nextPlayable } from '@/lib/games/release-date';
import { useSetGameStatus } from '@/hooks/useGameMutations';
import { useNowPlaying } from './useNowPlaying';
import { useGameDialog } from './useGameDialog';
import type { GameDialogProps } from '@/components/games/GameDetailModal';
import type { GameWithImage } from '@/types/games';
import { prefersReducedMotion, scrollBehavior } from '@/lib/motion';
import { queryKeys } from '@/lib/query-keys';
import { backlogCovers, type CarouselPools } from './useCarouselPools';
import type { GameStatus } from '@/lib/games/status';

/** Home page: the shared now-playing actions plus carousel detail and random pick. */
export function useHomeActions(userId: string | null) {
  const nowPlaying = useNowPlaying(userId);
  const setStatus = useSetGameStatus(userId);
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

  /** Starts the first queued game that's out, when nothing is being played. */
  const handlePlayNext = () => {
    const next = nextPlayable(nowPlaying.queue);
    if (!next) return;
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    nowPlaying.pickFromQueue(next.game_id);
  };

  const handleConfirmCarouselDetail = async (
    status: GameStatus,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!carouselModal) return;
    const { game } = carouselModal;
    setCarouselModal(null);

    if (status === 'playing') {
      // Not awaited. The dialog closes itself once this returns, and by the
      // time the server answered that would close whichever dialog had been
      // opened since. The game shows as playing at once either way.
      void handlePickGame(game);
      return;
    }

    setStatus.mutate({ gameId: game.id, status, date, notes, rating });
  };

  /**
   * The game dialog's Playing while another game is playing: play this one
   * instead (the other waits at the top of the queue), shown in the band.
   */
  const handlePlayInstead = async () => {
    if (!carouselModal) return;
    const { game } = carouselModal;
    setCarouselModal(null);
    // Not awaited, for the same reason as above.
    void handleSwitchTo(game).catch((err) => console.error('Failed to switch games:', err));
  };

  /** Plays a game instead of the one being played, shown in the band (with Undo). */
  const handleSwitchTo = async (game: GameWithImage) => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    await nowPlaying.switchTo(game);
  };

  // A carousel game's dialog. Carousels only hold backlog games.
  const dialogFor = useGameDialog(userId);
  const carouselDialog: GameDialogProps | null = carouselModal && {
    game: carouselModal.game,
    initialStatus: 'backlog',
    onClose: () => setCarouselModal(null),
    onConfirm: handleConfirmCarouselDetail,
    ...dialogFor(carouselModal.game, { onPlayInstead: handlePlayInstead }),
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
    const found = await findRandomBacklogGame(userId);
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
    /** A carousel game's detail dialog: its props, or null when it's closed. */
    carouselDialog,
    handlePickGame,
    handlePlayNext,
    handleFinishGame: nowPlaying.openFinish,
    handleDropGame: nowPlaying.openDrop,
    handleQueueGame: nowPlaying.addToQueue,
    handleOpenCarouselDetail: (game: GameWithImage) => setCarouselModal({ game }),
    handleSwitchTo,
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
