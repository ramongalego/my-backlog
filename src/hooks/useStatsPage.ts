'use client';

import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import { useAuth } from '@/hooks/useAuth';
import { useQueue } from '@/hooks/useQueue';
import { useLibraryGameDialog } from '@/hooks/useLibraryGameDialog';
import { computeStats, countedInStats } from '@/lib/stats/compute';
import { hasEnoughForProfile, playerFacts } from '@/lib/profile/facts';
import { insightSignature } from '@/lib/profile/saved';

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

  const profileReady = hasEnoughForProfile(games);
  // What a profile written now would be written from, so a saved one with
  // another signature is out of date. From the whole list, as the server reads
  // it: the facts count won't-play games, which Stats leaves out.
  const { data: library = [] } = useQuery(queries.gamesList(userId));
  const facts = profileReady ? playerFacts(library) : null;
  const profileSignature = facts ? insightSignature(facts) : null;

  // Stats reads the shared games list, so a change in the dialog shows at once.
  const { gameDialog, openGame } = useLibraryGameDialog(userId);

  return {
    stats,
    loading: !!userId && isPending,
    // The first load failed: show that, not an empty page.
    loadError: isLoadingError,
    retry: () => void refetch(),
    profileReady,
    profileSignature,
    gameDialog,
    openGame,
  };
}
