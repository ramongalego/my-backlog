'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import { useAuth } from '@/hooks/useAuth';
import { useAddToQueue, useQueue, useRemoveFromQueue } from '@/hooks/useQueue';
import { useSwitchGame } from '@/hooks/useSwitchGame';
import { useSetGameStatus } from '@/hooks/useGameMutations';
import { useManualGameActions } from '@/hooks/useManualGameActions';
import { computeStats, countedInStats, type PlayedALotGame } from '@/lib/stats/compute';
import { hasEnoughForProfile } from '@/lib/profile/facts';
import type { GameStatus } from '@/lib/games/status';

export function useStatsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const {
    data: games = [],
    isPending,
    isLoadingError,
    refetch,
  } = useQuery({
    // The Games page's list, shared, so the library is downloaded once.
    ...queries.gamesList(userId),
    select: countedInStats,
  });
  const { queuedGameIds } = useQueue(userId);
  // Only "Played a lot" needs categories, and only for heavily played games.
  const { data: categories = {} } = useQuery(queries.openEndedCategories(userId));

  const stats = computeStats(games, categories, queuedGameIds);

  const hasPlayingGame = games.some((g) => g.status === 'playing');
  // The player profile shows only once the library says enough about you.
  const profileReady = hasEnoughForProfile(games);

  // The game open in the detail dialog: one of the "Played a lot" games, which
  // are all in the backlog.
  const [openedGame, setOpenedGame] = useState<PlayedALotGame | null>(null);
  const manualGames = useManualGameActions(userId);
  const addGameToQueue = useAddToQueue(userId);
  const removeFromQueue = useRemoveFromQueue(userId);
  const switchGame = useSwitchGame(userId);
  // Stats reads the shared games list, so the change shows straight away.
  const statusMutation = useSetGameStatus(userId);

  /** The detail dialog's props for the open game, or null when it's closed. */
  const gameDialog = openedGame && {
    game: openedGame,
    onClose: () => setOpenedGame(null),
    onConfirm: (status: GameStatus, date: string, notes: string, rating: number | null) => {
      statusMutation.mutate({ gameId: openedGame.id, status, date, notes, rating });
      setOpenedGame(null);
    },
    manual: manualGames.dialogProps(openedGame),
    playing: hasPlayingGame
      ? {
          name: switchGame.playing?.name ?? null,
          onPlayInstead: () => switchGame.switchTo(openedGame),
        }
      : undefined,
    onAddToQueue: hasPlayingGame
      ? () => {
          setOpenedGame(null);
          addGameToQueue(openedGame);
        }
      : undefined,
    queued: queuedGameIds.has(openedGame.id)
      ? { onRemove: () => removeFromQueue(openedGame.id) }
      : undefined,
  };

  return {
    stats,
    loading: !!userId && isPending,
    // The first load failed: show that, not an empty page.
    loadError: isLoadingError,
    retry: () => void refetch(),
    profileReady,
    gameDialog,
    openGame: setOpenedGame,
  };
}
