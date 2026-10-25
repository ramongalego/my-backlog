'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/supabase/paginate';
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
      // The status route also takes the game off the queue if it was queued.
      await updateGameStatus(game.app_id, 'playing');
      setCurrentlyPlaying(game);
      removeFromPools(game.app_id);
    } catch (err) {
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
    } else {
      toast.error(`Could not add ${game.name} to the queue. Please try again.`);
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
    } catch (err) {
      console.error(`Failed to set game to ${status}:`, err);
      toast.error('Could not update the game. Please try again.');
      invalidateGamesAndQueue();
      setIsStatusLoading(false);
      return;
    }

    // The status change is saved at this point; the follow-ups below are
    // best-effort and must not report the finish/drop itself as failed.
    let promoted: GameWithImage | null = null;
    let counts = { gamesFinished: 0, totalGames: 0 };
    if (userId) {
      const supabase = createClient();
      const [countsResult, promotedResult] = await Promise.allSettled([
        fetchCompletionCounts(supabase, userId),
        promoteNextFromQueue(userId, supabase),
      ]);
      if (countsResult.status === 'fulfilled') counts = countsResult.value;
      if (promotedResult.status === 'fulfilled') {
        promoted = promotedResult.value;
      } else {
        console.error('Failed to start next queued game:', promotedResult.reason);
        toast.error("Couldn't start the next game from your queue.");
      }
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
    } catch (err) {
      console.error('Failed to move game to queue:', err);
      toast.error('Failed to move game to queue');
    }
    // Refetch either way: the first step may have succeeded before the second failed.
    invalidateGamesAndQueue();
    setIsStatusLoading(false);
  };

  const handleRandomPick = async () => {
    if (!userId || isStatusLoading) return;

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
