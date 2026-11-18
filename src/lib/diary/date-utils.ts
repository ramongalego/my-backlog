export function getMonthKey(isoDate: string): string {
  // Works for both "YYYY-MM-DD" and full ISO timestamps.
  return isoDate.slice(0, 7);
}

export function formatDay(isoDate: string): string {
  return isoDate.slice(8, 10);
}

/** In the user's local time zone. */
export function toLocalIsoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Local time: toISOString() would give the UTC date. */
export function todayIso(): string {
  return toLocalIsoDate(new Date());
}

/** "Aug 20", for the date chip on phones. */
export function shortDate(isoDate: string): string {
  const d = new Date(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export function monthName(isoDate: string): string {
  const d = new Date(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, 1);
  return d.toLocaleString('en-US', { month: 'long' });
}
