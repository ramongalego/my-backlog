// The hooks and the server prefetch both build their queries from here, so a
// query can't drift between them. A null user id (not known yet) skips the query.
import { queryOptions, skipToken } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import {
  loadCarouselPools,
  loadCurrentlyPlaying,
  loadDiaryEntries,
  loadFavoriteGames,
  loadGamesList,
  loadHasPassword,
  loadLibraryMeta,
  loadManualGames,
  loadOpenEndedCategories,
  loadQueue,
  loadRecentHistory,
  type CarouselPools,
} from './loaders';

const MINUTE = 60 * 1000;

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
  /** Status edits patch it in place. */
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

  favoriteGames: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.favorites(userId ?? ''),
      queryFn: load(userId, supabase, loadFavoriteGames),
      staleTime: 5 * MINUTE,
    }),

  /** Short-lived: anything done to a game anywhere adds to it. */
  history: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.history(userId ?? ''),
      queryFn: load(userId, supabase, loadRecentHistory),
      staleTime: 30 * 1000,
    }),

  /** It changes only by the reset link, which loads the app afresh. */
  hasPassword: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.auth.hasPassword(userId ?? ''),
      queryFn: load(userId, supabase, loadHasPassword),
      staleTime: 5 * MINUTE,
    }),

  manualGames: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.manual(userId ?? ''),
      queryFn: load(userId, supabase, loadManualGames),
    }),

  openEndedCategories: (userId: string | null, supabase?: SupabaseClient) =>
    queryOptions({
      queryKey: queryKeys.games.openEndedCategories(userId ?? ''),
      queryFn: load(userId, supabase, loadOpenEndedCategories),
      staleTime: 5 * MINUTE,
    }),

  /** The single source for queue items and "queued" badges. */
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
   * Always built on the server, so the browser never downloads the whole
   * backlog: the prefetch builds them directly, the browser through /api/carousels.
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
