import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import HomeView from './View';

export default async function HomePage() {
  const state = await prefetchForUser((supabase, userId) => [
    queries.playing(userId, supabase),
    // The counts, which decide which band Home shows, come from the (app)
    // layout's prefetch for the header.
    queries.queue(userId, supabase),
    queries.carousels(userId, supabase),
  ]);

  return (
    <HydrationBoundary state={state}>
      <HomeView />
    </HydrationBoundary>
  );
}
