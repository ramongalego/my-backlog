// One definition per query: its key, its loader and how long it stays fresh.
// The hooks and the server prefetch both build their queries from here, so a
// query can't drift between the two (or between two hooks sharing it).
//
// Hooks pass the user's id, null until it's known, which skips the query.
// The server prefetch passes its own Supabase client; the browser uses its own.
import { queryOptions, skipToken } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import {
  loadCarouselPools,
  loadCurrentlyPlaying,
  loadDiaryEntries,
  loadGamesList,
  loadLibraryMeta,
  loadManualGames,
  loadOpenEndedCategories,
  loadQueue,
  type CarouselPools,
} from './loaders';

const MINUTE = 60 * 1000;

/** The loader for a user's query, or skipToken while there's no user. */
function load<T>(
  userId: string | null,
  supabase: SupabaseClient | undefined,
  loader: (supabase: SupabaseClient, userId: string) => Promise<T>,
) {
  return userId ? () => loader(supabase ?? createClient(), userId) : skipToken;
}

async function fetchCarouselPools(): Promise<CarouselPools> {
  const res = await fetch('/api/carousels');
  if (!res.ok) throw new Error(`Failed to load carousels (${res.status})`);
  return res.json();
}

export const queries = {
  /** The whole library (Games page, Stats). Status edits patch it in place. */
  gamesList: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.list(userId ?? ''),
      queryFn: load(userId, supabase, loadGamesList),
      staleTime: 5 * MINUTE,
    }),

  diary: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.diary(userId ?? ''),
      queryFn: load(userId, supabase, loadDiaryEntries),
      staleTime: 5 * MINUTE,
    }),

  /** The game being played. Short-lived: it changes from Home, the queue and dialogs. */
  playing: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.playing(userId ?? ''),
      queryFn: load(userId, supabase, loadCurrentlyPlaying),
      staleTime: 30 * 1000,
    }),

  /** The games added by hand, for the Add game dialog. */
  manualGames: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.manual(userId ?? ''),
      queryFn: load(userId, supabase, loadManualGames),
    }),

  /** Categories of heavily played games, for Stats' "Played a lot". */
  openEndedCategories: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.openEndedCategories(userId ?? ''),
      queryFn: load(userId, supabase, loadOpenEndedCategories),
      staleTime: 5 * MINUTE,
    }),

  /**
   * The queue, straight from the database like every other query, not
   * through /api/queue, which added a hop. The single source for queue items
   * and "queued" badges.
   */
  queue: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.queue.list(userId ?? ''),
      queryFn: load(userId, supabase, loadQueue),
      staleTime: 2 * MINUTE,
    }),

  /** Counts for the header and for which band Home shows. */
  libraryMeta: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.library.meta(userId ?? ''),
      queryFn: load(userId, supabase, loadLibraryMeta),
      staleTime: 5 * MINUTE,
    }),

  /**
   * Home's carousels, always built on the server: the page prefetch builds
   * them directly, the browser through /api/carousels. Refetching them in the
   * browser used to download the whole backlog to keep a few dozen games.
   */
  carousels: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.carousels.byUser(userId ?? ''),
      queryFn: !userId
        ? skipToken
        : supabase
          ? () => loadCarouselPools(supabase, userId)
          : fetchCarouselPools,
      staleTime: 5 * MINUTE,
    }),
};
