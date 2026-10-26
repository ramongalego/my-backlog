// Server-only: createClient from '@/lib/supabase/server' depends on next/headers.
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  dehydrate,
  type DehydratedState,
} from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

interface PrefetchQuery {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  /**
   * Don't hold the page for this one: the page renders straight away in its
   * loading state and the data streams into the same response when it's
   * ready. For queries that grow with the library, like the games list.
   */
  stream?: boolean;
}

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
    const queries = build(supabase, userId);
    for (const { stream, ...query } of queries) if (stream) void queryClient.prefetchQuery(query);
    await Promise.all(
      queries
        .filter((q) => !q.stream)
        .map(({ queryKey, queryFn }) => queryClient.prefetchQuery({ queryKey, queryFn })),
    );
  }
  return dehydrate(queryClient);
}
