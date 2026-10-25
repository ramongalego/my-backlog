export function getMonthKey(isoDate: string): string {
  // Works for both "YYYY-MM-DD" and full ISO timestamps
  return isoDate.slice(0, 7);
}

export function formatMonthLabel(isoDate: string): { month: string; year: string } {
  // Parse directly from the string to avoid timezone / NaN issues
  const year = isoDate.slice(0, 4);
  const month = parseInt(isoDate.slice(5, 7), 10) - 1; // 0-indexed
  const d = new Date(Number(year), month, 1);
  return {
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    year,
  };
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
