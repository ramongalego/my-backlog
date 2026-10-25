import { parseReleaseDate } from './release-date';
import { isMetadataFresh } from './scoring';
import type { GameMetadata } from './metadata-fetch';

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
  const days = HLTB_BACKOFF_DAYS[Math.min(attempts, HLTB_BACKOFF_DAYS.length - 1)];
  return now - new Date(row.synced_at).getTime() >= days * DAY_MS;
}

/** Whether a shared-cache row can be used as-is instead of re-fetching upstream. */
export function isCacheUsable(row: CachedMetadata | null, now = Date.now()): boolean {
  if (!row || !isMetadataFresh(row.synced_at)) return false;
  if (row.type !== 'game') return true;
  if (row.main_story_hours === null) return !hltbRetryDue(row, now);
  if (!isRecentRelease(row.release_date, now)) return true;
  return now - new Date(row.synced_at).getTime() < RECENT_RELEASE_REFRESH_DAYS * DAY_MS;
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
 * counter is advanced or reset.
 */
export function mergeForCache(
  fresh: GameMetadata,
  existing: CachedMetadata | null,
): CachedMetadata {
  const merged: CachedMetadata = { ...fresh, hltb_attempts: existing?.hltb_attempts ?? 0 };
  if (existing) {
    for (const field of ENRICHMENT_FIELDS) {
      if (merged[field] === null && existing[field] !== null) {
        Object.assign(merged, { [field]: existing[field] });
      }
    }
  }
  if (merged.type === 'game') {
    merged.hltb_attempts = fresh.main_story_hours !== null ? 0 : (existing?.hltb_attempts ?? 0) + 1;
  }
  return merged;
}

/** Columns copied from the shared cache onto a user's `games` row. */
export function toGameRowUpdate(m: GameMetadata) {
  return {
    platform: m.platform,
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
