import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { loadGamesList, loadOpenEndedCategories, loadQueue } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import StatsView from './View';

export default async function StatsPage() {
  // The same list the Games page uses (Stats filters it), and the queue and
  // categories for "Played a lot", so nothing loads in after the page appears.
  const state = await prefetchForUser((supabase, userId) => [
    {
      queryKey: queryKeys.games.list(userId),
      queryFn: () => loadGamesList(supabase, userId),
      // Grows with the library: stream it rather than hold the page for it.
      stream: true,
    },
    { queryKey: queryKeys.queue.list(userId), queryFn: () => loadQueue(supabase, userId) },
    {
      queryKey: queryKeys.games.openEndedCategories(userId),
      queryFn: () => loadOpenEndedCategories(supabase, userId),
    },
  ]);

  return (
    <HydrationBoundary state={state}>
      <StatsView />
    </HydrationBoundary>
  );
}
