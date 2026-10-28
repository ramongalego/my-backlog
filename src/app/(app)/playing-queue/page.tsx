import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import PlayingQueueView from './View';

export default async function PlayingQueuePage() {
  const state = await prefetchForUser((supabase, userId) => [
    queries.playing(userId, supabase),
    queries.queue(userId, supabase),
  ]);

  return (
    <HydrationBoundary state={state}>
      <PlayingQueueView />
    </HydrationBoundary>
  );
}
