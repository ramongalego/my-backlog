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

/** Exact dates and vague ones ("Q2 2027") alike; null for "Coming soon". */
export function releaseYear(text: string | null | undefined): number | null {
  const match = /\b(\d{4})\b/.exec(text ?? '');
  return match ? Number(match[1]) : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// In its last week, the tag counts down instead of giving the date.
const COUNTDOWN_DAYS = 7;
const NO_DATE_YET = /^(to be announced|coming soon|tba|tbd)$/i;
const VAGUE_DATE = /^(?:Q[1-4] )?(\d{4})$/i;

interface UpcomingRelease {
  /** For the tag on the art: "Out Nov 5", in the last week "Out in 3 days", "Coming soon". */
  label: string;
  /** For its tooltip: "Releases Nov 5, 2026 (in 9 days)". */
  detail: string;
}

/**
 * Whose calendar "today" is read from. `local` is the player's in the browser:
 * the answer the app shows. `utc` is what the server renders and the browser's
 * first render repeats (see useReleaseZone), so the two always agree.
 */
export type ReleaseZone = 'local' | 'utc';

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
 * Null once the game is out or when there's no date. Worked out on each call,
 * so the tag goes away on release day by itself.
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
 * Only a released game is started for the player (Pick My Game, Random, the
 * next in the queue). A game with no date at all counts as out.
 */
export function isReleased(
  text: string | null | undefined,
  now = Date.now(),
  zone: ReleaseZone = 'local',
): boolean {
  return upcomingRelease(text, now, zone) === null;
}

/** Games not out yet keep their places in the queue and are skipped. */
export function nextPlayable<T extends { game: { release_date?: string | null } }>(
  queue: readonly T[],
  now = Date.now(),
  zone: ReleaseZone = 'local',
): T | undefined {
  return queue.find((q) => isReleased(q.game.release_date, now, zone));
}
