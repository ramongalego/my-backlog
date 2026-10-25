const DAY_MS = 24 * 60 * 60 * 1000;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/** "Last played 3 days ago", or null when Steam didn't share a date. */
export function formatLastPlayed(
  lastPlayedAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!lastPlayedAt) return null;
  const days = Math.floor((now - Date.parse(lastPlayedAt)) / DAY_MS);
  if (Number.isNaN(days)) return null;
  if (days < 1) return 'Last played today';
  if (days < 2) return 'Last played yesterday';
  if (days < 7) return `Last played ${plural(days, 'day')}`;
  if (days < 30) return `Last played ${plural(Math.floor(days / 7), 'week')}`;
  if (days < 365) return `Last played ${plural(Math.floor(days / 30), 'month')}`;
  return `Last played ${plural(Math.floor(days / 365), 'year')}`;
}
