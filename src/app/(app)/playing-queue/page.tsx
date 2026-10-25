import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { loadCurrentlyPlaying, loadQueue } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import PlayingQueueView from './View';

export default async function PlayingQueuePage() {
  const state = await prefetchForUser((supabase, userId) => [
    {
      queryKey: queryKeys.games.playing(userId),
      queryFn: () => loadCurrentlyPlaying(supabase, userId),
    },
    { queryKey: queryKeys.queue.list(userId), queryFn: () => loadQueue(supabase, userId) },
  ]);

  return (
    <HydrationBoundary state={state}>
      <PlayingQueueView />
    </HydrationBoundary>
  );
}
