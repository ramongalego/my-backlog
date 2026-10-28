import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import GamesView from './View';

export default async function GamesPage() {
  const state = await prefetchForUser((supabase, userId) => [
    // Grows with the library: stream it rather than hold the page for it.
    { ...queries.gamesList(userId, supabase), stream: true },
    queries.queue(userId, supabase),
  ]);

  return (
    <HydrationBoundary state={state}>
      <GamesView />
    </HydrationBoundary>
  );
}
