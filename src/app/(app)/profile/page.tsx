import { PrefetchedQueries } from '@/components/layout/PrefetchedQueries';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import ProfileView from './View';

export default async function ProfilePage() {
  // The Games page's list (the profile's figures, favorites and activity all
  // come from it) and the game being played, for when it was started.
  const state = await prefetchForUser((supabase, userId) => [
    // Grows with the library: stream it rather than hold the page for it.
    { ...queries.gamesList(userId, supabase), stream: true },
    queries.playing(userId, supabase),
    queries.favoriteGames(userId, supabase),
    // What Recent activity is drawn from, besides the games themselves.
    queries.history(userId, supabase),
    // For the game dialog (a queued game shows as Queue), as Games and Stats do.
    queries.queue(userId, supabase),
    // Whether the Account panel offers Change or Set password.
    queries.hasPassword(userId, supabase),
  ]);

  return (
    <>
      <PrefetchedQueries state={state} />
      <ProfileView />
    </>
  );
}
