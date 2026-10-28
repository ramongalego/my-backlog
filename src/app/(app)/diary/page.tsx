import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import DiaryView from './View';

export default async function DiaryPage() {
  const state = await prefetchForUser((supabase, userId) => [
    queries.diary(userId, supabase),
    queries.playing(userId, supabase),
  ]);

  return (
    <HydrationBoundary state={state}>
      <DiaryView />
    </HydrationBoundary>
  );
}
