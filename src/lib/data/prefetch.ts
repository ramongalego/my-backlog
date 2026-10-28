// Server-only: createClient from '@/lib/supabase/server' depends on next/headers.
import 'server-only';
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  dehydrate,
  type DehydratedState,
  type FetchQueryOptions,
} from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { queries } from './queries';

/** One of the shared queries (lib/data/queries), so it matches what the hooks read. */
type PrefetchQuery = ReturnType<(typeof queries)[keyof typeof queries]> & {
  /**
   * Don't hold the page for this one: the page renders straight away in its
   * loading state and the data streams into the same response when it's
   * ready. For queries that grow with the library, like the games list.
   */
  stream?: boolean;
};

/**
 * Runs the given queries on the server for the signed-in user and returns the
 * dehydrated cache for a <HydrationBoundary>, so client hooks render with data
 * immediately instead of fetching after hydration. A failed query is simply
 * left out and the client fetches it as before.
 */
export async function prefetchForUser(
  build: (supabase: SupabaseClient, userId: string) => PrefetchQuery[],
): Promise<DehydratedState> {
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        // Streamed queries are still pending here; their promise goes to the
        // client, which picks the result up instead of fetching it again.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
  const supabase = await createClient();
  // The proxy already verified the session; getClaims reads the user id from
  // the JWT without another round trip to Supabase Auth.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (userId) {
    const list = build(supabase, userId);
    // Each query has its own data type; prefetching only needs its options.
    const prefetch = (query: PrefetchQuery) =>
      queryClient.prefetchQuery(query as unknown as FetchQueryOptions);
    for (const query of list) if (query.stream) void prefetch(query);
    await Promise.all(list.filter((q) => !q.stream).map(prefetch));
  }
  return dehydrate(queryClient);
}
