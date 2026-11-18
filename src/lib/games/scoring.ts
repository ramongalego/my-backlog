export const METADATA_FRESHNESS_DAYS = 90;

// Bump when game_metadata gets a new column, so cached rows without it are refetched.
const METADATA_MIN_DATE = new Date('2026-02-27');

export function isMetadataFresh(syncedAt: string, now = Date.now()): boolean {
  const syncedDate = new Date(syncedAt);
  if (syncedDate < METADATA_MIN_DATE) return false;
  const diffDays = (now - syncedDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < METADATA_FRESHNESS_DAYS;
}

/** Pulls a score with few reviews toward the global average `C`; `m` reviews earn half trust. */
export function calculateBayesianScore(score: number, count: number): number {
  const m = 100;
  const C = 70;

  return Math.round((count / (count + m)) * score + (m / (count + m)) * C);
}
