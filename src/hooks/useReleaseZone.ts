'use client';

import { useSyncExternalStore } from 'react';
import type { ReleaseZone } from '@/lib/games/release-date';

const neverChanges = () => () => {};

function sameDayAsUtc(now = new Date()): boolean {
  return (
    now.getFullYear() === now.getUTCFullYear() &&
    now.getMonth() === now.getUTCMonth() &&
    now.getDate() === now.getUTCDate()
  );
}

/**
 * For upcomingRelease, isReleased and nextPlayable. The first render matches
 * the server's UTC so the two agree on whether a game is out, then switches to
 * the player's day; that only re-renders when the two dates differ.
 */
export function useReleaseZone(): ReleaseZone {
  return useSyncExternalStore<ReleaseZone>(
    neverChanges,
    () => (sameDayAsUtc() ? 'utc' : 'local'),
    () => 'utc',
  );
}
