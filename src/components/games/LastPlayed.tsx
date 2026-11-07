'use client';

import { formatLastPlayed } from '@/lib/games/last-played';

/** "Last played 3 days ago", from Steam; nothing when Steam doesn't share it. */
export function LastPlayed({
  lastPlayedAt,
  className = '',
}: {
  lastPlayedAt: string | null | undefined;
  className?: string;
}) {
  const text = formatLastPlayed(lastPlayedAt);
  // suppressHydrationWarning: the server and browser can straddle midnight.
  return text ? (
    <p className={`text-ink-500 ${className}`} suppressHydrationWarning>
      {text}
    </p>
  ) : null;
}
