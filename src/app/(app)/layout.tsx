import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { LibrarySyncGuard } from '@/components/LibrarySyncGuard';
import { PlaytimeRefresher } from '@/components/PlaytimeRefresher';
import { createClient } from '@/lib/supabase/server';
import { queryKeys } from '@/lib/query-keys';
import { loadLibraryMeta } from '@/lib/data/loaders';
import type { Profile } from '@/types/games';
import Providers from '../providers';

// The app shell: React Query, the auth-aware header, background library sync
// and playtime refreshes. The session is resolved here on the server and handed to useAuth, so
// the header and pages don't wait on a client-side auth round trip. Layouts
// persist across client navigations, so this runs once per full page load.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const queryClient = new QueryClient();
  let profile: Profile | null = null;
  if (user) {
    // Both need only the user id, so they run together: this is on the path to
    // every page's first paint.
    const [{ data }] = await Promise.all([
      supabase
        .from('profiles')
        .select('steam_id, steam_username, steam_avatar')
        .eq('id', user.id)
        .maybeSingle(),
      // The header's game count. Prefetched here rather than by pages: a query
      // the header has already created can only be hydrated after mount, which
      // made the server render a loading state that the client then replaced.
      queryClient.prefetchQuery({
        queryKey: queryKeys.library.meta(user.id),
        queryFn: () => loadLibraryMeta(supabase, user.id),
      }),
    ]);
    profile = data;
  }
  queryClient.setQueryData(queryKeys.auth.session(), { user, profile });

  return (
    <Providers>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Header />
        <LibrarySyncGuard />
        <PlaytimeRefresher />
        {children}
      </HydrationBoundary>
    </Providers>
  );
}
