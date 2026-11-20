'use client';

import { useSyncExternalStore } from 'react';
import { toLocalIsoDate } from '@/lib/diary/date-utils';

const neverChanges = () => () => {};

/**
 * Today in the player's own time zone, "YYYY-MM-DD"; null on the server and in
 * the first render, so what is drawn by day waits for the browser instead of
 * drawing the server's day (which is tomorrow there by the evening in America).
 */
export function useLocalToday(): string | null {
  return useSyncExternalStore(
    neverChanges,
    () => toLocalIsoDate(new Date()),
    () => null,
  );
}
