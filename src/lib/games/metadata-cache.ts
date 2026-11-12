import { parseReleaseDate } from './release-date';
import { isMetadataFresh } from './scoring';

/** A game's row in the shared metadata cache (game_metadata). */
export interface GameMetadata {
  app_id: number;
  platform: string;
  type: string | null;
  name: string | null;
  genres: string[] | null;
  categories: string[] | null;
  description: string | null;
  release_date: string | null;
  header_image: string | null;
  steam_review_score: number | null;
  steam_review_count: number | null;
  steam_review_weighted: number | null;
  main_story_hours: number | null;
  deck_compat: number | null;
  tags: string[] | null;
  synced_at: string;
}

export const METADATA_COLUMNS =
  'app_id, platform, type, name, genres, categories, description, release_date, header_image, steam_review_score, steam_review_count, steam_review_weighted, main_story_hours, deck_compat, tags, synced_at, hltb_attempts';

export type CachedMetadata = GameMetadata & { hltb_attempts: number | null };

// Backoff for games HLTB has no entry for, indexed by consecutive misses,
// then monthly. New releases often get an entry a few weeks after launch, so
// the early retries are close together. Without a backoff every user who owns
// such a game would re-trigger the full ~5-request upstream fetch on each sync.
const HLTB_BACKOFF_DAYS = [0, 3, 7, 14, 28];
const DAY_MS = 24 * 60 * 60 * 1000;

// Early HLTB times come from a handful of submissions and move a lot in a
// game's first months, so recent releases are re-checked monthly.
const RECENT_RELEASE_DAYS = 365;
const RECENT_RELEASE_REFRESH_DAYS = 30;

export function isRecentRelease(releaseDate: string | null, now: number): boolean {
  const released = parseReleaseDate(releaseDate);
  return released !== null && released <= now && now - released < RECENT_RELEASE_DAYS * DAY_MS;
}

function hltbRetryDue(row: CachedMetadata, now: number): boolean {
  const attempts = row.hltb_attempts ?? 0;
  if (attempts === 0) return true;
  // Past the table, every further miss waits another month. The wait counts
  // from synced_at, which an HLTB-only retry doesn't move, so it has to keep
  // growing: held at 28 days, a game HLTB doesn't have would be due again on
  // every visit from day 28 until its full refresh.
  const last = HLTB_BACKOFF_DAYS.length - 1;
  const days =
    attempts <= last
      ? HLTB_BACKOFF_DAYS[attempts]
      : HLTB_BACKOFF_DAYS[last] * (attempts - last + 1);
  return now - new Date(row.synced_at).getTime() >= days * DAY_MS;
}

/** One of a user's Steam games, as the per-visit sync check reads it. */
export interface SyncCheckGame {
  type?: string | null;
  categories?: string[] | null;
  metadata_synced?: boolean | null;
  main_story_hours?: number | null;
  release_date?: string | null;
}

/**
 * Whether a Steam game is sent to the sync endpoints on this visit: one never
 * synced, one still missing its HLTB time, or a recent release (whose time is
 * still settling). The endpoints answer these from the shared cache and only
 * go upstream when a retry or refresh is due.
 */
export function needsSyncCheck(game: SyncCheckGame, now: number): boolean {
  if (game.type && game.type !== 'game') return false;
  if (game.categories && !game.categories.includes('Single-player')) return false;
  if (!game.metadata_synced) return true;
  // Synced with nothing to show for it: Steam has no store page for it any
  // more (delisted). It has no cache row either, so asking again would fetch
  // from Steam on every visit for the same answer.
  if (!game.type) return false;
  return game.main_story_hours === null || isRecentRelease(game.release_date ?? null, now);
}

/** Whether a shared-cache row can be used as-is instead of re-fetching upstream. */
export function isCacheUsable(row: CachedMetadata | null, now = Date.now()): boolean {
  if (!row || !isMetadataFresh(row.synced_at, now)) return false;
  if (row.type !== 'game') return true;
  if (row.main_story_hours === null) return !hltbRetryDue(row, now);
  if (!isRecentRelease(row.release_date, now)) return true;
  return now - new Date(row.synced_at).getTime() < RECENT_RELEASE_REFRESH_DAYS * DAY_MS;
}

/**
 * A row that is fresh apart from a missing HLTB time that is due a retry. Its
 * Steam data can be used straight away while the time is looked up on its own
 * (see /api/games/sync/hltb), instead of re-fetching everything.
 */
export function needsOnlyHltb(row: CachedMetadata | null, now = Date.now()): boolean {
  return (
    !!row &&
    isMetadataFresh(row.synced_at, now) &&
    row.type === 'game' &&
    row.main_story_hours === null &&
    hltbRetryDue(row, now)
  );
}

const ENRICHMENT_FIELDS = [
  'main_story_hours',
  'steam_review_score',
  'steam_review_count',
  'steam_review_weighted',
  'tags',
  'deck_compat',
] as const;

/**
 * Prepares a freshly fetched snapshot for the shared cache. Enrichment lookups
 * return null on any upstream failure (HLTB down, Steam 429), so previously
 * known values are kept rather than overwritten with null, and the HLTB miss
 * counter is advanced or reset. A lookup HLTB refused (rate limited) isn't a
 * miss: the counter stays put, so the game is retried on the next sync instead
 * of days later.
 */
export function mergeForCache(
  fresh: GameMetadata & { hltbUnavailable?: boolean },
  existing: CachedMetadata | null,
): CachedMetadata {
  const { hltbUnavailable, ...snapshot } = fresh;
  const merged: CachedMetadata = { ...snapshot, hltb_attempts: existing?.hltb_attempts ?? 0 };
  if (existing) {
    for (const field of ENRICHMENT_FIELDS) {
      if (merged[field] === null && existing[field] !== null) {
        Object.assign(merged, { [field]: existing[field] });
      }
    }
  }
  if (merged.type === 'game' && !hltbUnavailable) {
    merged.hltb_attempts = fresh.main_story_hours !== null ? 0 : (existing?.hltb_attempts ?? 0) + 1;
  }
  return merged;
}

/**
 * Columns copied from the shared cache onto a user's `games` row. Not the
 * platform: that's the console you play it on, which you can change (a Steam
 * game you play on Switch), so the sync sets it only once, on insert.
 */
export function toGameRowUpdate(m: GameMetadata) {
  return {
    type: m.type,
    genres: m.genres,
    categories: m.categories,
    description: m.description,
    release_date: m.release_date,
    header_image: m.header_image,
    steam_review_score: m.steam_review_score,
    steam_review_count: m.steam_review_count,
    steam_review_weighted: m.steam_review_weighted,
    main_story_hours: m.main_story_hours,
    deck_compat: m.deck_compat,
    tags: m.tags,
    metadata_synced: true,
  };
}
