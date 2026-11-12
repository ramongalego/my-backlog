'use client';

import { useSyncExternalStore } from 'react';
import type { ReleaseZone } from '@/lib/games/release-date';

const neverChanges = () => () => {};

/** Whether it's the same calendar day here as in UTC right now. */
function sameDayAsUtc(now = new Date()): boolean {
  return (
    now.getFullYear() === now.getUTCFullYear() &&
    now.getMonth() === now.getUTCMonth() &&
    now.getDate() === now.getUTCDate()
  );
}

/**
 * The zone a component should read release dates in (upcomingRelease,
 * isReleased, nextPlayable). The server renders in UTC and the browser's first
 * render repeats that, so a page loads without the two disagreeing about
 * whether a game is out. Straight after, the browser switches to the player's
 * own day.
 *
 * Most of the time it's the same day in both, the answers are the same, and
 * nothing renders twice: the switch only happens in the hours around midnight
 * when the player's date and UTC's differ.
 */
export function useReleaseZone(): ReleaseZone {
  return useSyncExternalStore<ReleaseZone>(
    neverChanges,
    () => (sameDayAsUtc() ? 'utc' : 'local'),
    () => 'utc',
  );
}
