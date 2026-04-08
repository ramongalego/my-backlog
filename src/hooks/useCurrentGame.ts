'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { celebrateGameFinished } from '@/lib/confetti';
import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';
import { addToQueue } from '@/lib/games/queue';
import { updateGameStatus } from '@/lib/games/status';
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

export function useCurrentGame({
  userId,
  removeFromPools,
  addBackToPool,
  addQueuedAppId,
}: UseCurrentGameOpts) {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<GameWithImage | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);
  const [carouselModal, setCarouselModal] = useState<{ game: GameWithImage } | null>(null);

  // Load currently playing game
  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('games')
        .select(PLAYING_SELECT)
        .eq('user_id', userId)
        .eq('status', 'playing')
        .single();
      if (data) setCurrentlyPlaying(data);
    }
    load();
  }, [userId]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handlePickGame = useCallback(
    async (game: GameWithImage) => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setIsStatusLoading(true);
      try {
        await updateGameStatus(game.app_id, 'playing');
        setCurrentlyPlaying(game);
        removeFromPools(game.app_id);
      } catch (err) {
        console.error('Failed to pick game:', err);
      }
      setIsStatusLoading(false);
    },
    [removeFromPools],
  );

  const handleFinishGame = useCallback(() => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'finished' });
  }, [currentlyPlaying]);

  const handleDropGame = useCallback(() => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'dropped' });
  }, [currentlyPlaying]);

  const handleQueueGame = useCallback(
    async (game: GameWithImage) => {
      const ok = await addToQueue(game.app_id);
      if (ok) {
        addQueuedAppId(game.app_id);
        toast.success(`${game.name} added to the queue!`);
      }
    },
    [addQueuedAppId],
  );

  const handleOpenCarouselDetail = useCallback((game: GameWithImage) => {
    setCarouselModal({ game });
  }, []);

  const handleCloseCarouselModal = useCallback(() => setCarouselModal(null), []);

  const handleConfirmCarouselDetail = useCallback(
    async (status: string, date: string, notes: string, rating: number | null) => {
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
      }
    },
    [carouselModal, handlePickGame, removeFromPools],
  );

  const handleConfirmStatusChange = useCallback(
    async (status: string, date: string, notes: string, rating: number | null) => {
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
          const [{ count: finishedCount }, { count: totalCount }, promotedGame] = await Promise.all(
            [
              supabase
                .from('games')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .eq('type', 'game')
                .eq('status', 'finished'),
              supabase
                .from('games')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .eq('type', 'game')
                .neq('status', 'hidden'),
              promoteNextFromQueue(currentUser.id, supabase),
            ],
          );
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
            mainStoryHours:
              finishedGame.main_story_hours > 0 ? finishedGame.main_story_hours : null,
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
        console.error(`Failed to ${status} game:`, err);
      }
      setIsStatusLoading(false);
    },
    [currentlyPlaying],
  );

  const handleCloseStatusModal = useCallback(() => setStatusModal(null), []);
  const handleCloseSummary = useCallback(() => setGameSummary(null), []);

  const handleCancelGame = useCallback(async () => {
    if (!currentlyPlaying) return;
    setIsStatusLoading(true);
    try {
      await updateGameStatus(currentlyPlaying.app_id, 'backlog');
      addBackToPool(currentlyPlaying);
      setCurrentlyPlaying(null);
    } catch (err) {
      console.error('Failed to cancel game:', err);
    }
    setIsStatusLoading(false);
  }, [currentlyPlaying, addBackToPool]);

  const handleRandomPick = useCallback(async () => {
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
  }, [handlePickGame]);

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
