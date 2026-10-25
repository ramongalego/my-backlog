import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchForUser } from '@/lib/data/prefetch';
import { loadCurrentlyPlaying, loadDiaryEntries } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';
import DiaryView from './View';

export default async function DiaryPage() {
  const state = await prefetchForUser((supabase, userId) => [
    { queryKey: queryKeys.games.diary(userId), queryFn: () => loadDiaryEntries(supabase, userId) },
    {
      queryKey: queryKeys.games.playing(userId),
      queryFn: () => loadCurrentlyPlaying(supabase, userId),
    },
  ]);

  return (
    <HydrationBoundary state={state}>
      <DiaryView />
    </HydrationBoundary>
  );
}
