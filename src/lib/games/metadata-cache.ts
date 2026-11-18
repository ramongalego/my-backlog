import { syncedArt } from '@/lib/games/art';
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

// Days to wait after each consecutive HLTB miss. Without it every owner's sync
// would redo the ~5-request fetch; early waits are short because new releases
// often get an entry a few weeks after launch.
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
  // Past the table, each miss waits another month. The wait counts from
  // synced_at, which an HLTB-only retry doesn't move, so a flat 28 days would
  // be due again on every visit.
  const last = HLTB_BACKOFF_DAYS.length - 1;
  const days =
    attempts <= last
      ? HLTB_BACKOFF_DAYS[attempts]
      : HLTB_BACKOFF_DAYS[last] * (attempts - last + 1);
  return now - new Date(row.synced_at).getTime() >= days * DAY_MS;
}

export interface SyncCheckGame {
  type?: string | null;
  categories?: string[] | null;
  metadata_synced?: boolean | null;
  main_story_hours?: number | null;
  release_date?: string | null;
}

/**
 * Whether a Steam game goes to the sync endpoints on this visit. They answer
 * from the shared cache and only go upstream when a retry or refresh is due.
 */
export function needsSyncCheck(game: SyncCheckGame, now: number): boolean {
  if (game.type && game.type !== 'game') return false;
  if (game.categories && !game.categories.includes('Single-player')) return false;
  if (!game.metadata_synced) return true;
  // Synced with no type: delisted from Steam, with no cache row, so asking
  // again would fetch from Steam on every visit for the same answer.
  if (!game.type) return false;
  return game.main_story_hours === null || isRecentRelease(game.release_date ?? null, now);
}

export function isCacheUsable(row: CachedMetadata | null, now = Date.now()): boolean {
  if (!row || !isMetadataFresh(row.synced_at, now)) return false;
  if (row.type !== 'game') return true;
  if (row.main_story_hours === null) return !hltbRetryDue(row, now);
  if (!isRecentRelease(row.release_date, now)) return true;
  return now - new Date(row.synced_at).getTime() < RECENT_RELEASE_REFRESH_DAYS * DAY_MS;
}

/**
 * Fresh but for an HLTB time due a retry: its Steam data is used as is and the
 * time is looked up alone (see /api/games/sync/hltb).
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
 * Enrichment lookups return null on any upstream failure, so known values are
 * kept instead of nulled. A lookup HLTB refused (rate limited) isn't a miss:
 * the counter stays, so the next sync retries instead of days later.
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
 * Leaves out the platform: the player can move a Steam game to a console, so
 * the sync sets it only on insert. With `artChosen`, the cache's art becomes
 * the default behind the player's choice.
 */
export function toGameRowUpdate(m: GameMetadata, artChosen = false) {
  return {
    type: m.type,
    genres: m.genres,
    categories: m.categories,
    description: m.description,
    release_date: m.release_date,
    ...syncedArt({ art_chosen: artChosen }, m.header_image),
    steam_review_score: m.steam_review_score,
    steam_review_count: m.steam_review_count,
    steam_review_weighted: m.steam_review_weighted,
    main_story_hours: m.main_story_hours,
    deck_compat: m.deck_compat,
    tags: m.tags,
    metadata_synced: true,
  };
}
