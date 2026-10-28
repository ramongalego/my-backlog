import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import StatsView from './View';

export default async function StatsPage() {
  // The same list the Games page uses (Stats filters it), and the queue and
  // categories for "Played a lot", so nothing loads in after the page appears.
  const state = await prefetchForUser((supabase, userId) => [
    // Grows with the library: stream it rather than hold the page for it.
    { ...queries.gamesList(userId, supabase), stream: true },
    queries.queue(userId, supabase),
    queries.openEndedCategories(userId, supabase),
  ]);

  return (
    <HydrationBoundary state={state}>
      <StatsView />
    </HydrationBoundary>
  );
}
