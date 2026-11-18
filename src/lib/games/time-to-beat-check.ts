import { parseReleaseDate } from './release-date';

// For games added by hand: Steam games follow the shared cache's schedule
// (metadata-cache.ts).

const DAY_MS = 24 * 60 * 60 * 1000;
// A game with no time is usually not out yet, or only just out: worth asking
// again, but not often.
const MISSING_RECHECK_DAYS = 7;
// A new release's time moves most in its first months (78.5h became 95h in
// eight weeks), so it's checked weekly then, monthly until it's a year old.
const SETTLING_DAYS = 90;
const SETTLING_RECHECK_DAYS = 7;
const RECENT_DAYS = 365;
const RECENT_RECHECK_DAYS = 30;

/** A query can skip games checked more recently than this. */
export const SHORTEST_RECHECK_DAYS = Math.min(MISSING_RECHECK_DAYS, SETTLING_RECHECK_DAYS);

interface CheckedGame {
  main_story_hours: number | null;
  /** Display text, e.g. "Sep 17, 2026". */
  release_date: string | null;
  /** Null for a game never asked about since it was added. */
  hltb_checked_at: string | null;
}

/**
 * Once a game has a time, it's left alone if it's over a year old, not out, or
 * has no known release date.
 */
export function timeToBeatCheckDue(game: CheckedGame, now: number): boolean {
  const checked = game.hltb_checked_at ? Date.parse(game.hltb_checked_at) : NaN;
  const daysSinceCheck = Number.isNaN(checked) ? Infinity : (now - checked) / DAY_MS;
  if (game.main_story_hours === null) return daysSinceCheck >= MISSING_RECHECK_DAYS;

  const released = parseReleaseDate(game.release_date);
  if (released === null || released > now) return false;
  const daysOut = (now - released) / DAY_MS;
  if (daysOut >= RECENT_DAYS) return false;
  return daysSinceCheck >= (daysOut < SETTLING_DAYS ? SETTLING_RECHECK_DAYS : RECENT_RECHECK_DAYS);
}
