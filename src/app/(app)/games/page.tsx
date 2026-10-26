import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { loadGamesList, loadQueue } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import GamesView from './View';

export default async function GamesPage() {
  const state = await prefetchForUser((supabase, userId) => [
    {
      queryKey: queryKeys.games.list(userId),
      queryFn: () => loadGamesList(supabase, userId),
      // Grows with the library: stream it rather than hold the page for it.
      stream: true,
    },
    { queryKey: queryKeys.queue.list(userId), queryFn: () => loadQueue(supabase, userId) },
  ]);

  return (
    <HydrationBoundary state={state}>
      <GamesView />
    </HydrationBoundary>
  );
}
