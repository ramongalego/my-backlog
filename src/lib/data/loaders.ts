// Data loaders shared by server-side prefetching (server Supabase client) and
// client-side React Query hooks (browser Supabase client). Keeping one copy
// guarantees the prefetched data has exactly the shape the hooks expect.
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/paginate';
import {
  buildCarouselPools,
  type CarouselGame,
  type CarouselPools,
  type LovedGame,
} from '@/lib/games/carousels';
import type { GameWithImage, QueueItem } from '@/types/games';

// ─── Games page ─────────────────────────────────────────────────────────────

export interface GameItem {
  app_id: number;
  name: string;
  playtime_forever: number;
  steam_review_score: number | null;
  steam_review_count: number | null;
  steam_review_weighted: number | null;
  header_image: string | null;
  main_story_hours: number | null;
  status: string | null;
  notes: string | null;
  rating: number | null;
  finished_at: string | null;
  dropped_at: string | null;
  tags: string[] | null;
  deck_compat?: number | null;
  /** When the game first appeared in the library (set on insert, never updated). */
  created_at: string;
  /** Steam's display date, e.g. "Sep 28, 2010" or "To be announced". */
  release_date: string | null;
  last_played_at: string | null;
}

export function loadGamesList(supabase: SupabaseClient, userId: string): Promise<GameItem[]> {
  return fetchAllRows<GameItem>((from, to) =>
    supabase
      .from('games')
      .select(
        'app_id, name, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, header_image, main_story_hours, status, notes, rating, finished_at, dropped_at, tags, deck_compat, created_at, release_date, last_played_at',
      )
      .eq('user_id', userId)
      .eq('type', 'game')
      .order('playtime_forever', { ascending: false })
      .order('app_id')
      .range(from, to),
  );
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface GameForStats {
  app_id: number;
  name: string;
  status: string | null;
  playtime_forever: number;
  main_story_hours: number | null;
  tags: string[] | null;
  rating: number | null;
  finished_at: string | null;
  header_image: string | null;
  release_date: string | null;
  deck_compat: number | null;
  categories: string[] | null;
  last_played_at: string | null;
}

export function loadStatsGames(supabase: SupabaseClient, userId: string): Promise<GameForStats[]> {
  return fetchAllRows<GameForStats>((from, to) =>
    supabase
      .from('games')
      .select(
        'app_id, name, status, playtime_forever, main_story_hours, tags, rating, finished_at, header_image, release_date, deck_compat, categories, last_played_at',
      )
      .eq('user_id', userId)
      .eq('type', 'game')
      .not('status', 'in', '(hidden,wont_play)')
      .order('app_id')
      .range(from, to),
  );
}

// ─── Diary ──────────────────────────────────────────────────────────────────

export interface DiaryEntry {
  app_id: number;
  name: string;
  header_image: string | null;
  rating: number | null;
  notes: string | null;
  finished_at: string | null;
}

export async function loadDiaryEntries(
  supabase: SupabaseClient,
  userId: string,
): Promise<DiaryEntry[]> {
  const { data, error } = await supabase
    .from('games')
    .select('app_id, name, header_image, rating, notes, finished_at')
    .eq('user_id', userId)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as DiaryEntry[];
}

// ─── Now playing + queue ────────────────────────────────────────────────────

export const PLAYING_GAME_SELECT =
  'app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, steam_review_count, deck_compat, last_played_at';

export async function loadCurrentlyPlaying(
  supabase: SupabaseClient,
  userId: string,
): Promise<GameWithImage | null> {
  const { data, error } = await supabase
    .from('games')
    .select(PLAYING_GAME_SELECT)
    .eq('user_id', userId)
    .eq('status', 'playing')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function loadQueue(supabase: SupabaseClient, userId: string): Promise<QueueItem[]> {
  // playing_queue has no FK to games, so the join is done in two queries.
  const { data: rows, error } = await supabase
    .from('playing_queue')
    .select('id, app_id, position')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  if (!rows?.length) return [];

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select(
      'app_id, name, header_image, playtime_forever, main_story_hours, steam_review_score, steam_review_count, deck_compat, last_played_at',
    )
    .eq('user_id', userId)
    .in(
      'app_id',
      rows.map((r) => r.app_id),
    );
  if (gamesError) throw gamesError;

  const gamesById = new Map((games ?? []).map((g) => [g.app_id, g]));
  return rows.map((row) => {
    const g = gamesById.get(row.app_id);
    return {
      id: row.id,
      app_id: row.app_id,
      position: row.position,
      game: {
        name: g?.name ?? '',
        header_image: g?.header_image ?? null,
        playtime_forever: g?.playtime_forever ?? 0,
        main_story_hours: g?.main_story_hours ?? null,
        steam_review_score: g?.steam_review_score ?? null,
        steam_review_count: g?.steam_review_count ?? null,
        deck_compat: g?.deck_compat ?? null,
        last_played_at: g?.last_played_at ?? null,
      },
    };
  });
}

// ─── Home ───────────────────────────────────────────────────────────────────

export interface LibraryMeta {
  gameCount: number;
  historyCount: number;
}

export async function loadLibraryMeta(
  supabase: SupabaseClient,
  userId: string,
): Promise<LibraryMeta> {
  const [totalResult, historyResult] = await Promise.all([
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .neq('status', 'hidden'),
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .in('status', ['finished', 'dropped']),
  ]);
  if (totalResult.error) throw totalResult.error;
  if (historyResult.error) throw historyResult.error;

  return {
    gameCount: totalResult.count ?? 0,
    historyCount: historyResult.count ?? 0,
  };
}

export type { CarouselPools };

const CAROUSEL_SELECT =
  'app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, deck_compat, tags, categories, created_at, last_played_at';
const BACKLOG_FILTER = 'status.is.null,status.eq.backlog';

export async function loadCarouselPools(
  supabase: SupabaseClient,
  userId: string,
): Promise<CarouselPools> {
  const [backlog, loved, firstImported, queued] = await Promise.all([
    // The whole backlog: the carousels need tags, editions and history to
    // rank it, which the database can't do on its own.
    fetchAllRows<CarouselGame>((from, to) =>
      supabase
        .from('games')
        .select(CAROUSEL_SELECT)
        .eq('user_id', userId)
        .eq('type', 'game')
        .or(BACKLOG_FILTER)
        .order('app_id')
        .range(from, to),
    ),
    supabase
      .from('games')
      .select('name, rating, tags, finished_at')
      .eq('user_id', userId)
      .eq('type', 'game')
      .eq('status', 'finished')
      .gte('rating', 8)
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(20),
    // When the library was first imported, for Recently Added.
    supabase
      .from('games')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1),
    fetchAllRows<{ app_id: number }>((from, to) =>
      supabase
        .from('playing_queue')
        .select('app_id')
        .eq('user_id', userId)
        .order('app_id')
        .range(from, to),
    ),
  ]);
  if (loved.error) throw loved.error;
  if (firstImported.error) throw firstImported.error;

  return buildCarouselPools(
    backlog,
    (loved.data ?? []) as LovedGame[],
    firstImported.data?.[0]?.created_at,
    new Set(queued.map((q) => q.app_id)),
  );
}
