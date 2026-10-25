// Data loaders shared by server-side prefetching (server Supabase client) and
// client-side React Query hooks (browser Supabase client). Keeping one copy
// guarantees the prefetched data has exactly the shape the hooks expect.
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/paginate';
import {
  SHORT_GAME_MIN_HOURS,
  SHORT_GAME_MAX_HOURS,
  WEEKEND_GAME_MAX_HOURS,
  MAX_PLAYTIME_MINUTES,
} from '@/lib/games/filtering';
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
}

export function loadGamesList(supabase: SupabaseClient, userId: string): Promise<GameItem[]> {
  return fetchAllRows<GameItem>((from, to) =>
    supabase
      .from('games')
      .select(
        'app_id, name, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, header_image, main_story_hours, status, notes, rating, finished_at, dropped_at, tags, deck_compat',
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
}

export function loadStatsGames(supabase: SupabaseClient, userId: string): Promise<GameForStats[]> {
  return fetchAllRows<GameForStats>((from, to) =>
    supabase
      .from('games')
      .select(
        'app_id, name, status, playtime_forever, main_story_hours, tags, rating, finished_at, header_image, release_date, deck_compat',
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
  'app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, deck_compat';

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
      'app_id, name, header_image, playtime_forever, main_story_hours, steam_review_score, deck_compat',
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
        deck_compat: g?.deck_compat ?? null,
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

export interface CarouselPools {
  shortGamesPool: GameWithImage[];
  weekendGamesPool: GameWithImage[];
  highlyRatedGamesPool: GameWithImage[];
  hiddenGemsPool: GameWithImage[];
  recentlyAddedPool: GameWithImage[];
}

const CAROUSEL_SELECT =
  'app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, deck_compat';
const SINGLE_PLAYER = ['Single-player'];
const BACKLOG_FILTER = 'status.is.null,status.eq.backlog';

export async function loadCarouselPools(
  supabase: SupabaseClient,
  userId: string,
): Promise<CarouselPools> {
  const results = await Promise.all([
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .not('main_story_hours', 'is', null)
      .not('steam_review_weighted', 'is', null)
      .gte('main_story_hours', SHORT_GAME_MIN_HOURS)
      .lte('main_story_hours', SHORT_GAME_MAX_HOURS)
      .lte('playtime_forever', MAX_PLAYTIME_MINUTES)
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('steam_review_weighted', { ascending: false }),
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .not('main_story_hours', 'is', null)
      .not('steam_review_weighted', 'is', null)
      .gt('main_story_hours', SHORT_GAME_MAX_HOURS)
      .lte('main_story_hours', WEEKEND_GAME_MAX_HOURS)
      .lte('playtime_forever', MAX_PLAYTIME_MINUTES)
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('steam_review_weighted', { ascending: false }),
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .not('steam_review_weighted', 'is', null)
      .eq('playtime_forever', 0)
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('steam_review_weighted', { ascending: false })
      .limit(20),
    // Hidden Gems: high score, few reviews
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .gte('steam_review_score', 80)
      .gt('steam_review_count', 10)
      .lte('steam_review_count', 500)
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('steam_review_score', { ascending: false })
      .limit(20),
    // Recently Added (higher app_id = newer Steam release)
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('app_id', { ascending: false })
      .limit(20),
  ]);

  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
  const [short, weekend, highlyRated, hiddenGems, recentlyAdded] = results.map(
    (r) => (r.data ?? []) as GameWithImage[],
  );

  return {
    shortGamesPool: short,
    weekendGamesPool: weekend,
    highlyRatedGamesPool: highlyRated,
    hiddenGemsPool: hiddenGems,
    recentlyAddedPool: recentlyAdded,
  };
}
