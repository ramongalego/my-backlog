// Server-only: createClient from '@/lib/supabase/server' depends on next/headers.
import { QueryClient, dehydrate, type DehydratedState } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

interface PrefetchQuery {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
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
  const queryClient = new QueryClient();
  const supabase = await createClient();
  // The proxy already verified the session; getClaims reads the user id from
  // the JWT without another round trip to Supabase Auth.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (userId) {
    await Promise.all(build(supabase, userId).map((query) => queryClient.prefetchQuery(query)));
  }
  return dehydrate(queryClient);
}
