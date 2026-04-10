'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { celebrateGameFinished } from '@/lib/confetti';
import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';
import { addToQueue } from '@/lib/games/queue';
import { updateGameStatus } from '@/lib/games/status';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { GameWithImage } from '@/types/games';
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

const PLAYING_SELECT =
  'app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, deck_compat';

async function fetchCurrentlyPlaying(userId: string): Promise<GameWithImage | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('games')
    .select(PLAYING_SELECT)
    .eq('user_id', userId)
    .eq('status', 'playing')
    .single();
  return data ?? null;
}

export function useCurrentGame({
  userId,
  removeFromPools,
  addBackToPool,
  addQueuedAppId,
}: UseCurrentGameOpts) {
  const queryClient = useQueryClient();
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);
  const [carouselModal, setCarouselModal] = useState<{ game: GameWithImage } | null>(null);

  const { data: currentlyPlaying = null } = useQuery({
    queryKey: queryKeys.games.playing(),
    queryFn: () => fetchCurrentlyPlaying(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  const setCurrentlyPlaying = (game: GameWithImage | null) => {
    queryClient.setQueryData(queryKeys.games.playing(), game);
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handlePickGame = async (game: GameWithImage) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsStatusLoading(true);
    try {
      await updateGameStatus(game.app_id, 'playing');
      setCurrentlyPlaying(game);
      removeFromPools(game.app_id);
    } catch (err) {
      Sentry.captureException(err);
      console.error('Failed to pick game:', err);
      toast.error('Failed to start playing');
    }
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
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.all });
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
  };

  const handleConfirmStatusChange = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!currentlyPlaying) return;
    const finishedGame = currentlyPlaying;
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
      let gamesFinished = 0;
      let totalGames = 0;

      if (currentUser) {
        const [{ count: finishedCount }, { count: totalCount }, promotedGame] = await Promise.all([
          supabase
            .from('games')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('type', 'game')
            .eq('status', 'finished'),
          supabase
            .from('games')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('type', 'game')
            .neq('status', 'hidden'),
          promoteNextFromQueue(currentUser.id, supabase),
        ]);
        promoted = promotedGame;
        gamesFinished = finishedCount ?? 0;
        totalGames = totalCount ?? 0;
      }

      setCurrentlyPlaying(promoted);

      if (status === 'finished') {
        setGameSummary({
          gameName: finishedGame.name,
          headerImage: finishedGame.header_image,
          playtimeMinutes: finishedGame.playtime_forever,
          mainStoryHours: finishedGame.main_story_hours > 0 ? finishedGame.main_story_hours : null,
          rating,
          gamesFinished,
          totalGames,
          backlogHoursRemoved:
            finishedGame.main_story_hours > 0 ? finishedGame.main_story_hours : null,
          nextGame: promoted?.name ?? null,
        });
        celebrateGameFinished();
      }
    } catch (err) {
      Sentry.captureException(err);
      console.error(`Failed to ${status} game:`, err);
      toast.error(`Failed to ${status} game`);
    }
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
      .lte('playtime_forever', 120)
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
    handleRandomPick,
  };
}
