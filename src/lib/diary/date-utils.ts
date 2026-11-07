export function getMonthKey(isoDate: string): string {
  // Works for both "YYYY-MM-DD" and full ISO timestamps
  return isoDate.slice(0, 7);
}

export function formatDay(isoDate: string): string {
  // Slice the day digits directly — already zero-padded in ISO format
  return isoDate.slice(8, 10);
}

/** Formats a Date as "YYYY-MM-DD" in the user's local timezone. */
export function toLocalIsoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Today's date as "YYYY-MM-DD" in local time (toISOString() would give the UTC date). */
export function todayIso(): string {
  return toLocalIsoDate(new Date());
}

/** "20 Aug" from an ISO date, for the date chip on phones. */
export function shortDate(isoDate: string): string {
  const d = new Date(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short' });
}

export function monthName(isoDate: string): string {
  const d = new Date(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, 1);
  return d.toLocaleString('en-US', { month: 'long' });
}
