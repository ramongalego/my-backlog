const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one "YYYY-MM-DD" (or a moment, read as its date) to another. */
export function daysApart(from: string, to: string): number {
  return Math.floor((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY_MS);
}

/**
 * How long a game was played over, start to finish, counting both days: "12
 * days", "3 weeks", "a year". Null for a same-day finish, which is more often
 * catching up on an old game than one sitting.
 */
export function spanOfDays(days: number): string | null {
  if (Number.isNaN(days) || days < 1) return null;
  if (days < 14) return `${days + 1} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = Math.round(days / 365);
  return years === 1 ? 'a year' : `${years} years`;
}

/** As spanOfDays, from the day it was started to the day it was finished. */
export const playedOver = (startedAt: string, finishedAt: string) =>
  spanOfDays(daysApart(startedAt, finishedAt));
