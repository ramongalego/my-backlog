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
