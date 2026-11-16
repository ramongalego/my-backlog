'use client';

import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import { useAuth } from '@/hooks/useAuth';
import { useQueue } from '@/hooks/useQueue';
import { useLibraryGameDialog } from '@/hooks/useLibraryGameDialog';
import { computeStats, countedInStats } from '@/lib/stats/compute';
import { hasEnoughForProfile } from '@/lib/profile/facts';

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

  // A game's dialog, opened from "Played a lot" or the highest rated. Stats
  // reads the shared games list, so a change shows straight away.
  const { gameDialog, openGame } = useLibraryGameDialog(userId);

  return {
    stats,
    loading: !!userId && isPending,
    // The first load failed: show that, not an empty page.
    loadError: isLoadingError,
    retry: () => void refetch(),
    profileReady,
    gameDialog,
    /** Opens a game's dialog, by its id. */
    openGame,
  };
}
