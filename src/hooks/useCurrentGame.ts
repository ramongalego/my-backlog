'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { celebrateGameFinished } from '@/lib/confetti';
import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';
import { addToQueue } from '@/lib/games/queue';
import { fetchCurrentlyPlaying } from '@/lib/games/currentGame';
import { updateGameStatus } from '@/lib/games/status';
import { fetchCompletionCounts, buildCompletionSummary } from '@/lib/games/completion';
import { RANDOM_PICK_MAX_PLAYTIME_MINUTES } from '@/lib/games/filtering';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/lib/mutations';
import { toast } from 'sonner';
import type { GameWithImage, QueueItem } from '@/types/games';
import type { GameSummaryData } from '@/components/games/GameSummaryModal';

interface StatusModal {
  action: 'finished' | 'dropped';
}

interface UseCurrentGameOpts {
  userId: string | null;
  removeFromPools: (appId: number) => void;
  addBackToPool: (game: GameWithImage) => void;
  addQueuedAppId: (appId: number) => void;
}

const ANONYMOUS_PLAYING_KEY = [...queryKeys.games.all, 'playing', 'anonymous'] as const;

export function useCurrentGame({
  userId,
  removeFromPools,
  addBackToPool,
  addQueuedAppId,
}: UseCurrentGameOpts) {
  const queryClient = useQueryClient();
  const { gamesAndQueue: invalidateGamesAndQueue, queue: invalidateQueue } = useInvalidateQueries();
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);
  const [carouselModal, setCarouselModal] = useState<{ game: GameWithImage } | null>(null);

  const playingKey = userId ? queryKeys.games.playing(userId) : ANONYMOUS_PLAYING_KEY;

  const { data: currentlyPlaying = null } = useQuery({
    queryKey: playingKey,
    queryFn: () => fetchCurrentlyPlaying(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  const setCurrentlyPlaying = (game: GameWithImage | null) => {
    queryClient.setQueryData(playingKey, game);
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handlePickGame = async (game: GameWithImage) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsStatusLoading(true);
    try {
      await updateGameStatus(game.app_id, 'playing');
      // Idempotent — the DELETE route is a no-op if the game isn't queued,
      // so we can safely call it on every pick to handle the case where the
      // user directly picks a game that happens to be in their queue.
      const res = await fetch(`/api/queue?appId=${game.app_id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to remove from queue (${res.status})`);
      setCurrentlyPlaying(game);
      removeFromPools(game.app_id);
    } catch (err) {
      Sentry.captureException(err);
      console.error('Failed to pick game:', err);
      toast.error('Failed to start playing');
    }
    invalidateGamesAndQueue();
    setIsStatusLoading(false);
  };

  const handleFinishGame = () => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'finished' });
  };

  const handleDropGame = () => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'dropped' });
  };

  const handleQueueGame = async (game: GameWithImage) => {
    const ok = await addToQueue(game.app_id);
    if (ok) {
      addQueuedAppId(game.app_id);
      invalidateQueue();
      toast.success(`${game.name} added to the queue!`);
    }
  };

  const handleOpenCarouselDetail = (game: GameWithImage) => {
    setCarouselModal({ game });
  };

  const handleCloseCarouselModal = () => setCarouselModal(null);

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
      removeFromPools(game.app_id);
    } catch (err) {
      Sentry.captureException(err);
      console.error('Failed to update game status:', err);
      toast.error('Failed to update game status');
    }
    invalidateGamesAndQueue();
  };

  const handleConfirmStatusChange = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!currentlyPlaying) return;
    const finishedGame = currentlyPlaying;
    setStatusModal(null);
    setIsStatusLoading(true);
    try {
      await updateGameStatus(finishedGame.app_id, status, {
        finishedAt: status === 'finished' ? date : undefined,
        droppedAt: status === 'dropped' ? date : undefined,
        notes,
        rating,
      });

      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      let promoted: GameWithImage | null = null;
      let counts = { gamesFinished: 0, totalGames: 0 };

      if (currentUser) {
        const [completionCounts, promotedGame] = await Promise.all([
          fetchCompletionCounts(supabase, currentUser.id),
          promoteNextFromQueue(currentUser.id, supabase),
        ]);
        promoted = promotedGame;
        counts = completionCounts;
      }

      setCurrentlyPlaying(promoted);
      if (promoted && userId) {
        queryClient.setQueryData(queryKeys.queue.list(userId), (old: QueueItem[] | undefined) =>
          (old ?? []).filter((q) => q.app_id !== promoted.app_id),
        );
      }

      if (status === 'finished') {
        setGameSummary(buildCompletionSummary({ finishedGame, promoted, counts, rating }));
        celebrateGameFinished();
      }
    } catch (err) {
      Sentry.captureException(err);
      console.error(`Failed to ${status} game:`, err);
      toast.error(`Failed to ${status} game`);
    }
    invalidateGamesAndQueue();
    setIsStatusLoading(false);
  };

  const handleCloseStatusModal = () => setStatusModal(null);
  const handleCloseSummary = () => setGameSummary(null);

  const handleCancelGame = async () => {
    if (!currentlyPlaying) return;
    setIsStatusLoading(true);
    try {
      await updateGameStatus(currentlyPlaying.app_id, 'backlog');
      addBackToPool(currentlyPlaying);
      setCurrentlyPlaying(null);
    } catch (err) {
      Sentry.captureException(err);
      console.error('Failed to cancel game:', err);
      toast.error('Failed to move game to backlog');
    }
    invalidateGamesAndQueue();
    setIsStatusLoading(false);
  };

  const handleMoveCurrentToQueue = async () => {
    if (!currentlyPlaying) return;
    const game = currentlyPlaying;
    setIsStatusLoading(true);
    try {
      await updateGameStatus(game.app_id, 'backlog');
      const ok = await addToQueue(game.app_id);
      if (!ok) throw new Error('Failed to add to queue');
      setCurrentlyPlaying(null);
      addQueuedAppId(game.app_id);
      invalidateGamesAndQueue();
    } catch (err) {
      Sentry.captureException(err);
      console.error('Failed to move game to queue:', err);
      toast.error('Failed to move game to queue');
    }
    setIsStatusLoading(false);
  };

  const handleRandomPick = async () => {
    const supabase = createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { data: eligibleGames } = await supabase
      .from('games')
      .select('app_id, name, header_image, main_story_hours, playtime_forever')
      .eq('user_id', currentUser.id)
      .eq('type', 'game')
      .not('main_story_hours', 'is', null)
      .lte('playtime_forever', RANDOM_PICK_MAX_PLAYTIME_MINUTES)
      .contains('categories', ['Single-player'])
      .or('status.is.null,status.eq.backlog');

    if (!eligibleGames || eligibleGames.length === 0) return;

    const randomIndex = Math.floor(Math.random() * eligibleGames.length);
    await handlePickGame(eligibleGames[randomIndex]);
  };

  return {
    currentlyPlaying,
    setCurrentlyPlaying,
    isStatusLoading,
    statusModal,
    gameSummary,
    carouselModal,
    handlePickGame,
    handleFinishGame,
    handleDropGame,
    handleQueueGame,
    handleOpenCarouselDetail,
    handleConfirmCarouselDetail,
    handleCloseCarouselModal,
    handleConfirmStatusChange,
    handleCloseStatusModal,
    handleCloseSummary,
    handleCancelGame,
    handleMoveCurrentToQueue,
    handleRandomPick,
  };
}
