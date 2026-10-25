import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { loadStatsGames } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import StatsView from './View';

export default async function StatsPage() {
  const state = await prefetchForUser((supabase, userId) => [
    { queryKey: queryKeys.games.stats(userId), queryFn: () => loadStatsGames(supabase, userId) },
  ]);

  return (
    <HydrationBoundary state={state}>
      <StatsView />
    </HydrationBoundary>
  );
}
