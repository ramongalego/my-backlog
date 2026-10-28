import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { loadCarouselPools, loadCurrentlyPlaying, loadQueue } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import HomeView from './View';

export default async function HomePage() {
  const state = await prefetchForUser((supabase, userId) => [
    {
      queryKey: queryKeys.games.playing(userId),
      queryFn: () => loadCurrentlyPlaying(supabase, userId),
    },
    // The counts, which decide which band Home shows, come from the (app)
    // layout's prefetch for the header.
    { queryKey: queryKeys.queue.list(userId), queryFn: () => loadQueue(supabase, userId) },
    {
      queryKey: queryKeys.carousels.byUser(userId),
      queryFn: () => loadCarouselPools(supabase, userId),
    },
  ]);

  return (
    <HydrationBoundary state={state}>
      <HomeView />
    </HydrationBoundary>
  );
}
