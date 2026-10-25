import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { loadGamesList, loadQueue } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import StatsView from './View';

export default async function StatsPage() {
  // The same list the Games page uses (Stats filters it), and the queue for
  // "Played a lot", so nothing loads in after the page appears.
  const state = await prefetchForUser((supabase, userId) => [
    { queryKey: queryKeys.games.list(userId), queryFn: () => loadGamesList(supabase, userId) },
    { queryKey: queryKeys.queue.list(userId), queryFn: () => loadQueue(supabase, userId) },
  ]);

  return (
    <HydrationBoundary state={state}>
      <StatsView />
    </HydrationBoundary>
  );
}
