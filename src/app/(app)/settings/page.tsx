import { PrefetchedQueries } from '@/components/layout/PrefetchedQueries';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import SettingsView from './View';

export default async function SettingsPage() {
  const state = await prefetchForUser((supabase, userId) => [
    // Whether the page offers Change or Set password.
    queries.hasPassword(userId, supabase),
    // Only for what leaves with Steam and whether there's anything to export:
    // streamed, so the page never waits on the library.
    { ...queries.gamesList(userId, supabase), stream: true },
  ]);

  return (
    <>
      <PrefetchedQueries state={state} />
      <SettingsView />
    </>
  );
}
