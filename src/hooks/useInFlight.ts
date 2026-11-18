'use client';

import { useRef } from 'react';

/**
 * A button that hides or disables itself is still there until the redraw, so
 * a double click would send the same change again.
 */
export function useInFlight() {
  const keys = useRef(new Set<string>());
  /** False: the same action is already on its way. */
  const take = (key: string): boolean => {
    if (keys.current.has(key)) return false;
    keys.current.add(key);
    return true;
  };
  const release = (key: string) => void keys.current.delete(key);
  return {
    take,
    release,
    /** Holds the key until `send` settles. Never rejects: `send` reports its own failure. */
    once: (key: string, send: () => Promise<unknown>): Promise<void> => {
      if (!take(key)) return Promise.resolve();
      const done = () => release(key);
      return send().then(done, done);
    },
  };
}
