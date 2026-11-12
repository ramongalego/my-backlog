/**
 * Steam's release dates are display text, in either order: "Sep 28, 2010" or
 * "28 Sep, 2010". Returns the timestamp, or null for "To be announced",
 * "Coming soon" and missing dates.
 */
export function parseReleaseDate(text: string | null | undefined): number | null {
  if (!text) return null;
  const time = Date.parse(text);
  if (!Number.isNaN(time)) return time;
  // "28 Sep, 2010" isn't parsed everywhere; reorder it to "Sep 28, 2010".
  const match = /^(\d{1,2}) ([A-Za-z]{3,}),? (\d{4})$/.exec(text.trim());
  if (!match) return null;
  const reordered = Date.parse(`${match[2]} ${match[1]}, ${match[3]}`);
  return Number.isNaN(reordered) ? null : reordered;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// In its last week, the tag counts down instead of giving the date.
const COUNTDOWN_DAYS = 7;
// Store pages' words for a game with no date yet.
const NO_DATE_YET = /^(to be announced|coming soon|tba|tbd)$/i;
// A release known only by year or quarter: "2027", "Q2 2027".
const VAGUE_DATE = /^(?:Q[1-4] )?(\d{4})$/i;

interface UpcomingRelease {
  /** For the tag on the art: "Out Nov 5", in the last week "Out in 3 days", "Coming soon". */
  label: string;
  /** For its tooltip: "Releases Nov 5, 2026 (in 9 days)". */
  detail: string;
}

/**
 * Whose calendar "today" is read from. A release date is a whole day, so
 * whether a game is out depends on what day it is where you ask:
 *
 * - `local`: the time zone of the machine running the code. In the browser,
 *   the player's; that's the answer the app shows.
 * - `utc`: the same day everywhere. The server renders a page in this and the
 *   browser's first render repeats it (see useReleaseZone), so the two agree
 *   whatever time zone the player is in.
 */
export type ReleaseZone = 'local' | 'utc';

/** Midnight at the start of a moment's day, and that day's year, in a zone. */
function dayOf(time: number, zone: ReleaseZone): { start: number; year: number } {
  const date = new Date(time);
  if (zone === 'utc') {
    return {
      start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      year: date.getUTCFullYear(),
    };
  }
  date.setHours(0, 0, 0, 0);
  return { start: date.getTime(), year: date.getFullYear() };
}

/**
 * A game that isn't out yet, from its stored release date (IGDB's or Steam's
 * display text), or null once it's out or when there's no date at all. It's
 * worked out each time, so the tag goes away on release day by itself.
 */
export function upcomingRelease(
  text: string | null | undefined,
  now = Date.now(),
  zone: ReleaseZone = 'local',
): UpcomingRelease | null {
  const date = text?.trim();
  if (!date) return null;
  if (NO_DATE_YET.test(date)) {
    return { label: 'Coming soon', detail: 'No release date announced yet' };
  }
  const today = dayOf(now, zone);
  const vague = VAGUE_DATE.exec(date);
  if (vague) {
    // Only a year (or quarter): out sometime in it, so upcoming until it ends.
    if (Number(vague[1]) < today.year) return null;
    return { label: `Out ${date}`, detail: `Releases in ${date}` };
  }
  // The date's text is parsed as a day in this machine's zone; in UTC the
  // same calendar day is wanted, not the same instant.
  const parsed = parseReleaseDate(date);
  if (parsed === null) return null;
  const local = new Date(parsed);
  const released =
    zone === 'utc'
      ? Date.UTC(local.getFullYear(), local.getMonth(), local.getDate())
      : local.getTime();
  // A release date is a whole day: it's out from that morning.
  if (released <= today.start) return null;

  const sameYear = local.getFullYear() === today.year;
  const days = Math.round((released - today.start) / DAY_MS);
  const timeZone = zone === 'utc' ? 'UTC' : undefined;
  const day = new Date(released);
  const short = day.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone,
  });
  const full = day.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
  return {
    label:
      days === 1 ? 'Out tomorrow' : days <= COUNTDOWN_DAYS ? `Out in ${days} days` : `Out ${short}`,
    detail: `Releases ${full} (${days === 1 ? 'tomorrow' : `in ${days} days`})`,
  };
}

/**
 * Whether a game is out, so it can be started for you: by Pick My Game,
 * Random, or as the next in the queue when you finish one. A game with no date
 * at all counts as out.
 */
export function isReleased(
  text: string | null | undefined,
  now = Date.now(),
  zone: ReleaseZone = 'local',
): boolean {
  return upcomingRelease(text, now, zone) === null;
}

/**
 * The queued game that starts next: the first one that's out. Games not out
 * yet keep their places and are skipped until they are.
 */
export function nextPlayable<T extends { game: { release_date?: string | null } }>(
  queue: readonly T[],
  now = Date.now(),
  zone: ReleaseZone = 'local',
): T | undefined {
  return queue.find((q) => isReleased(q.game.release_date, now, zone));
}
