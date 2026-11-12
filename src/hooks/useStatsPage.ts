'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import { useAuth } from '@/hooks/useAuth';
import { useQueue } from '@/hooks/useQueue';
import { useSetGameStatus } from '@/hooks/useGameMutations';
import { useGameDialog } from '@/hooks/useGameDialog';
import type { GameDialogProps } from '@/components/games/GameDetailModal';
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

  // The player profile shows only once the library says enough about you.
  const profileReady = hasEnoughForProfile(games);

  // The game open in the detail dialog: one of the "Played a lot" games, which
  // are all in the backlog.
  const [openedGame, setOpenedGame] = useState<PlayedALotGame | null>(null);
  const dialogFor = useGameDialog(userId);
  // Stats reads the shared games list, so the change shows straight away.
  const statusMutation = useSetGameStatus(userId);

  /** The detail dialog's props for the open game, or null when it's closed. */
  const gameDialog: GameDialogProps | null = openedGame && {
    game: openedGame,
    initialStatus: 'backlog',
    onClose: () => setOpenedGame(null),
    onConfirm: (status: GameStatus, date: string, notes: string, rating: number | null) => {
      statusMutation.mutate({ gameId: openedGame.id, status, date, notes, rating });
      setOpenedGame(null);
    },
    ...dialogFor(openedGame),
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
