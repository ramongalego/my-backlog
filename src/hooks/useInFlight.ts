'use client';

import { useRef } from 'react';

/**
 * Lets an action through once at a time, by key. A button that goes away or
 * is disabled when its action starts is still there until the page redraws,
 * so clicks that land before that (a double click) would send the same change
 * again.
 */
export function useInFlight() {
  const keys = useRef(new Set<string>());
  /** Takes the key if nothing holds it. False: the same action is already on its way. */
  const take = (key: string): boolean => {
    if (keys.current.has(key)) return false;
    keys.current.add(key);
    return true;
  };
  const release = (key: string) => void keys.current.delete(key);
  return {
    take,
    release,
    /**
     * Runs `send` unless the same action is already on its way, and holds the
     * key until it settles. Never rejects: `send` reports its own failure.
     */
    once: (key: string, send: () => Promise<unknown>): Promise<void> => {
      if (!take(key)) return Promise.resolve();
      const done = () => release(key);
      return send().then(done, done);
    },
  };
}
