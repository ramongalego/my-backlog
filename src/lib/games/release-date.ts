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
