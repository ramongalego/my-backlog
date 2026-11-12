import { PrefetchedQueries } from '@/components/layout/PrefetchedQueries';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import DiaryView from './View';

export default async function DiaryPage() {
  const state = await prefetchForUser((supabase, userId) => [
    queries.diary(userId, supabase),
    queries.playing(userId, supabase),
  ]);

  return (
    <>
      <PrefetchedQueries state={state} />
      <DiaryView />
    </>
  );
}
