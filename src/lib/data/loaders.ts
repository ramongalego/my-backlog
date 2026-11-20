// Shared by the server prefetch and the client hooks, so prefetched data has
// exactly the shape the hooks expect.
import { libraryPlatforms, STEAM_PLATFORM, type LibraryPlatforms } from '@/lib/games/consoles';
import type { ActivityEvent, PlayedPick } from '@/lib/account/activity';
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
import type { GameStatus } from '@/lib/games/status';
import type { SavedInsights } from '@/lib/profile/saved';

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
  critic_score: number | null;
  critic_count: number | null;
  steam_review_weighted: number | null;
  header_image: string | null;
  main_story_hours: number | null;
  status: GameStatus;
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
 * The Games page and Stats share this cache entry (Stats filters it with a
 * select), so moving between them doesn't download the library twice.
 */
export function loadGamesList(supabase: SupabaseClient, userId: string): Promise<GameItem[]> {
  return fetchAllRows<GameItem>((from, to) =>
    supabase
      .from('games')
      .select(
        'id, source, platform, app_id, name, playtime_forever, steam_review_score, steam_review_count, critic_score, critic_count, steam_review_weighted, header_image, main_story_hours, status, notes, rating, finished_at, dropped_at, tags, deck_compat, created_at, release_date, last_played_at',
      )
      .eq('user_id', userId)
      .eq('type', 'game')
      .order('playtime_forever', { ascending: false })
      .order('id')
      .range(from, to),
  );
}

/**
 * For "Played a lot" on Stats (is it multiplayer-first?). Kept out of the games
 * list: categories are nearly a fifth of a row, and nothing else reads them.
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

interface ManualGame {
  id: number;
  igdb_id: number | null;
  platform: string | null;
  created_at: string;
}

/** For the Add game dialog: which IGDB games are already in the library, and on which console. */
export async function loadManualGames(
  supabase: SupabaseClient,
  userId: string,
): Promise<ManualGame[]> {
  return fetchAllRows<ManualGame>((from, to) =>
    supabase
      .from('games')
      .select('id, igdb_id, platform, created_at')
      .eq('user_id', userId)
      .eq('source', 'manual')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to),
  );
}

export interface DiaryEntry {
  id: number;
  source: string;
  platform: string | null;
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
  critic_score: number | null;
  critic_count: number | null;
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
      'id, source, platform, app_id, name, header_image, rating, notes, finished_at, playtime_forever, main_story_hours, steam_review_score, steam_review_count, critic_score, critic_count, deck_compat, last_played_at',
    )
    .eq('user_id', userId)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as DiaryEntry[];
}

export const PLAYING_GAME_SELECT =
  'id, source, platform, app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, steam_review_count, critic_score, critic_count, deck_compat, last_played_at, release_date';

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
  'source, platform, app_id, name, header_image, playtime_forever, main_story_hours, steam_review_score, steam_review_count, critic_score, critic_count, deck_compat, last_played_at, release_date, started_at';

export async function loadQueue(supabase: SupabaseClient, userId: string): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from('playing_queue')
    .select(`id, game_id, position, game:games(${QUEUE_GAME_COLUMNS})`)
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as QueueItem[];
}

/** In the order they were picked. */
export async function loadFavoriteGames(
  supabase: SupabaseClient,
  userId: string,
): Promise<number[]> {
  const { data, error } = await supabase
    .from('favorite_games')
    .select('game_id')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.game_id as number);
}

/** How many of the latest events the Profile page's activity is drawn from. */
const RECENT_HISTORY = 50;

/** Newest first, for the Profile page's Recent activity (lib/account/activity.ts). */
export async function loadRecentHistory(
  supabase: SupabaseClient,
  userId: string,
  /** More than the Profile page reads, where most of them will be left out. */
  limit = RECENT_HISTORY,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('game_events')
    .select('id, game_id, kind, changes, created_at, updated_at')
    .eq('user_id', userId)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityEvent[];
}

/**
 * Everything logged since a day ("YYYY-MM-DD"), oldest first, and a day more:
 * where it began in the player's time zone isn't known here. For Activity
 * history, which counts them by day and shows only its own.
 */
export async function loadHistorySince(
  supabase: SupabaseClient,
  userId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const dayEarlier = new Date(Date.parse(since) - 24 * 60 * 60 * 1000).toISOString();
  return fetchAllRows<ActivityEvent>((from, to) =>
    supabase
      .from('game_events')
      .select('id, game_id, kind, changes, created_at, updated_at')
      .eq('user_id', userId)
      .gte('created_at', dayEarlier)
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/** The latest picks the player pressed Play on: enough to cover the history read with them. */
const RECENT_PICKS = 100;

/** Picks the player started (Random, or Pick My Game), newest first. */
export async function loadPlayedPicks(
  supabase: SupabaseClient,
  userId: string,
  limit = RECENT_PICKS,
): Promise<PlayedPick[]> {
  const { data, error } = await supabase
    .from('game_picks')
    .select('game_id, kind, answered_at')
    .eq('user_id', userId)
    .eq('outcome', 'played')
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PlayedPick[];
}

/**
 * One made with Google or Discord has none until it sets one. Null when the
 * database couldn't say: the caller then goes by `signedUpWithPassword`.
 */
/** The player's saved profile and roast, read as they are: nothing is written here. */
export async function loadSavedInsights(
  supabase: SupabaseClient,
  userId: string,
): Promise<SavedInsights> {
  const { data, error } = await supabase
    .from('player_insights')
    .select('tone, headline, paragraphs, signature, generated_at')
    .eq('user_id', userId);
  if (error) throw error;
  const saved: SavedInsights = { profile: null, roast: null };
  for (const row of data ?? []) {
    if (row.tone !== 'profile' && row.tone !== 'roast') continue;
    saved[row.tone as keyof SavedInsights] = {
      headline: row.headline,
      paragraphs: row.paragraphs,
      signature: row.signature,
      generatedAt: row.generated_at,
    };
  }
  return saved;
}

export async function loadHasPassword(supabase: SupabaseClient): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('account_has_password');
  return !error && typeof data === 'boolean' ? data : null;
}

export interface LibraryMeta {
  gameCount: number;
  historyCount: number;
  /** Games still to play (backlog or no status): what Pick My Game picks from. */
  backlogCount: number;
  /** Finished games: the "12/150 finished" the finish summary shows straight away. */
  finishedCount: number;
  /** What the library is played on: for saying where each game is played. */
  platforms: LibraryPlatforms;
}

/** The fewest backlog games worth picking between; until then Home asks for more. */
export const MIN_GAMES_TO_PICK = 3;

export async function loadLibraryMeta(
  supabase: SupabaseClient,
  userId: string,
): Promise<LibraryMeta> {
  const [totalResult, historyResult, backlogResult, finishedResult, platforms] = await Promise.all([
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
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .or(BACKLOG_FILTER),
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .eq('status', 'finished'),
    loadLibraryPlatforms(supabase, userId),
  ]);
  if (totalResult.error) throw totalResult.error;
  if (historyResult.error) throw historyResult.error;
  if (backlogResult.error) throw backlogResult.error;
  if (finishedResult.error) throw finishedResult.error;

  return {
    gameCount: totalResult.count ?? 0,
    historyCount: historyResult.count ?? 0,
    backlogCount: backlogResult.count ?? 0,
    finishedCount: finishedResult.count ?? 0,
    platforms,
  };
}

/**
 * How many of the library's games are on each platform. Steam games played
 * on Steam (most of a Steam library) are counted, not listed; the rest, games
 * added by hand and Steam games moved to a console, are few, and listed.
 */
async function loadLibraryPlatforms(
  supabase: SupabaseClient,
  userId: string,
): Promise<LibraryPlatforms> {
  const shown = () => supabase.from('games').select('platform', { count: 'exact', head: false });
  const [onSteam, others] = await Promise.all([
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .neq('status', 'hidden')
      .eq('source', 'steam')
      .or(`platform.is.null,platform.eq.${STEAM_PLATFORM}`),
    fetchAllRows<{ platform: string | null }>((from, to) =>
      shown()
        .eq('user_id', userId)
        .eq('type', 'game')
        .neq('status', 'hidden')
        .or(`source.eq.manual,platform.neq.${STEAM_PLATFORM}`)
        .order('id')
        .range(from, to),
    ),
  ]);
  if (onSteam.error) throw onSteam.error;
  const counts = new Map<string, number>([[STEAM_PLATFORM, onSteam.count ?? 0]]);
  for (const { platform } of others) {
    if (platform) counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }
  return libraryPlatforms(counts);
}

export type { CarouselPools };

const CAROUSEL_SELECT =
  'id, source, platform, app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, critic_score, critic_count, steam_review_weighted, deck_compat, tags, categories, created_at, last_played_at, release_date';
const BACKLOG_FILTER = 'status.is.null,status.eq.backlog';

/**
 * Built on the server (the prefetch and /api/carousels), so the browser only
 * receives finished rows. Queued games are left out in the browser (useCarouselPools).
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
    // When the Steam library was first imported, for Recently Added. Games
    // added by hand before Steam was linked don't count.
    supabase
      .from('games')
      .select('created_at')
      .eq('user_id', userId)
      .eq('source', 'steam')
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
