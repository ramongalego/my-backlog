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

export interface UpcomingRelease {
  /** For the tag on the art: "Out Nov 5", in the last week "Out in 3 days", "Coming soon". */
  label: string;
  /** For its tooltip: "Releases Nov 5, 2026 (in 9 days)". */
  detail: string;
}

/**
 * A game that isn't out yet, from its stored release date (IGDB's or Steam's
 * display text), or null once it's out or when there's no date at all. It's
 * worked out each time, so the tag goes away on release day by itself.
 */
export function upcomingRelease(
  text: string | null | undefined,
  now = Date.now(),
): UpcomingRelease | null {
  const date = text?.trim();
  if (!date) return null;
  if (NO_DATE_YET.test(date)) {
    return { label: 'Coming soon', detail: 'No release date announced yet' };
  }
  const vague = VAGUE_DATE.exec(date);
  if (vague) {
    // Only a year (or quarter): out sometime in it, so upcoming until it ends.
    if (Number(vague[1]) < new Date(now).getFullYear()) return null;
    return { label: `Out ${date}`, detail: `Releases in ${date}` };
  }
  const released = parseReleaseDate(date);
  // A release date is a whole day: it's out from that morning.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (released === null || released <= today.getTime()) return null;

  const day = new Date(released);
  const sameYear = day.getFullYear() === today.getFullYear();
  const days = Math.round((released - today.getTime()) / DAY_MS);
  const short = day.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const full = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return {
    label:
      days === 1 ? 'Out tomorrow' : days <= COUNTDOWN_DAYS ? `Out in ${days} days` : `Out ${short}`,
    detail: `Releases ${full} (${days === 1 ? 'tomorrow' : `in ${days} days`})`,
  };
}
