// Data loaders shared by server-side prefetching (server Supabase client) and
// client-side React Query hooks (browser Supabase client). Keeping one copy
// guarantees the prefetched data has exactly the shape the hooks expect.
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { OPEN_ENDED_MIN_MINUTES } from '@/lib/games/played-a-lot';
import {
  buildCarouselPools,
  slimPools,
  type CarouselGame,
  type CarouselPools,
  type LovedGame,
} from '@/lib/games/carousels';
import type { GameWithImage, QueueItem } from '@/types/games';

// ─── Games page ─────────────────────────────────────────────────────────────

export interface GameItem {
  id: number;
  /** 'steam' (synced) or 'manual' (added by hand). */
  source: string;
  /** The console a manual game is on, e.g. "Switch 2". */
  platform: string | null;
  /** Steam's app id, for Steam games only. */
  app_id: number | null;
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

/**
 * Every game in the library. The Games page and Stats share this one cache
 * entry (Stats filters it with a select), so moving between them doesn't
 * download the library twice.
 */
export function loadGamesList(supabase: SupabaseClient, userId: string): Promise<GameItem[]> {
  return fetchAllRows<GameItem>((from, to) =>
    supabase
      .from('games')
      .select(
        'id, source, platform, app_id, name, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, header_image, main_story_hours, status, notes, rating, finished_at, dropped_at, tags, deck_compat, created_at, release_date, last_played_at',
      )
      .eq('user_id', userId)
      .eq('type', 'game')
      .order('playtime_forever', { ascending: false })
      .order('id')
      .range(from, to),
  );
}

/**
 * Steam categories for the backlog games with enough hours that "Played a
 * lot" on Stats needs to know if they're multiplayer-first. Kept out of the
 * games list, where categories were nearly a fifth of every row and nothing
 * else reads them.
 */
export async function loadOpenEndedCategories(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<number, string[] | null>> {
  const rows = await fetchAllRows<{ id: number; categories: string[] | null }>((from, to) =>
    supabase
      .from('games')
      .select('id, categories')
      .eq('user_id', userId)
      .eq('type', 'game')
      .or('status.is.null,status.eq.backlog')
      .gte('playtime_forever', OPEN_ENDED_MIN_MINUTES)
      .order('id')
      .range(from, to),
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.categories]));
}

// ─── Diary ──────────────────────────────────────────────────────────────────

export interface DiaryEntry {
  id: number;
  app_id: number | null;
  name: string;
  header_image: string | null;
  rating: number | null;
  notes: string | null;
  finished_at: string | null;
  // For the meta row on each entry and in its modal, as on every other card.
  playtime_forever: number;
  main_story_hours: number | null;
  steam_review_score: number | null;
  steam_review_count: number | null;
  deck_compat: number | null;
  last_played_at: string | null;
}

export async function loadDiaryEntries(
  supabase: SupabaseClient,
  userId: string,
): Promise<DiaryEntry[]> {
  const { data, error } = await supabase
    .from('games')
    .select(
      'id, app_id, name, header_image, rating, notes, finished_at, playtime_forever, main_story_hours, steam_review_score, steam_review_count, deck_compat, last_played_at',
    )
    .eq('user_id', userId)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as DiaryEntry[];
}

// ─── Now playing + queue ────────────────────────────────────────────────────

export const PLAYING_GAME_SELECT =
  'id, app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, steam_review_count, deck_compat, last_played_at';

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

const QUEUE_GAME_COLUMNS =
  'app_id, name, header_image, playtime_forever, main_story_hours, steam_review_score, steam_review_count, deck_compat, last_played_at';

export async function loadQueue(supabase: SupabaseClient, userId: string): Promise<QueueItem[]> {
  // The queue references its games, so one query returns each row with its game.
  const { data, error } = await supabase
    .from('playing_queue')
    .select(`id, game_id, position, game:games(${QUEUE_GAME_COLUMNS})`)
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as QueueItem[];
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
  'id, app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, deck_compat, tags, categories, created_at, last_played_at';
const BACKLOG_FILTER = 'status.is.null,status.eq.backlog';

/**
 * The Home carousels, built where the backlog is read: on the server for the
 * page prefetch and, through /api/carousels, for every refetch, so the browser
 * only ever receives the finished rows. Queued games are left out in the
 * browser (useCarouselPools), from the queue it already has.
 */
export async function loadCarouselPools(
  supabase: SupabaseClient,
  userId: string,
): Promise<CarouselPools> {
  const [backlog, loved, firstImported] = await Promise.all([
    // The whole backlog: the carousels need tags, editions and history to
    // rank it, which the database can't do on its own.
    fetchAllRows<CarouselGame>((from, to) =>
      supabase
        .from('games')
        .select(CAROUSEL_SELECT)
        .eq('user_id', userId)
        .eq('type', 'game')
        .or(BACKLOG_FILTER)
        .order('id')
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
  ]);
  if (loved.error) throw loved.error;
  if (firstImported.error) throw firstImported.error;

  return slimPools(
    buildCarouselPools(
      backlog,
      (loved.data ?? []) as LovedGame[],
      firstImported.data?.[0]?.created_at,
    ),
  );
}
