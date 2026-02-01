export const METADATA_FRESHNESS_DAYS = 7;

/**
 * Checks if cached metadata is still fresh (less than 7 days old)
 */
export function isMetadataFresh(syncedAt: string): boolean {
  const syncedDate = new Date(syncedAt);
  const now = new Date();
  const diffDays = (now.getTime() - syncedDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < METADATA_FRESHNESS_DAYS;
}

/**
 * Calculates a Bayesian weighted score for games
 *
 * This gives games with fewer reviews a score closer to the global average (70),
 * while games with many reviews get a score closer to their actual score.
 *
 * Formula: (count / (count + m)) * score + (m / (count + m)) * C
 * Where m = 100 (minimum reviews for confidence) and C = 70 (global average)
 */
export function calculateBayesianScore(score: number, count: number): number {
  const m = 100; // Minimum reviews needed for confidence
  const C = 70;  // Global average score

  return Math.round(
    (count / (count + m)) * score +
    (m / (count + m)) * C
  );
}
