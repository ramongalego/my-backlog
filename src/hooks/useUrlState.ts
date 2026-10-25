'use client';

import { useSearchParams } from 'next/navigation';

/**
 * A string value kept in the URL query (`?key=value`) so it survives
 * navigating away and back, and can be bookmarked or shared. Writes use
 * history.replaceState, which Next keeps in sync with useSearchParams without
 * a server round trip. The default value is left out of the URL.
 */
export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
  allowed?: readonly T[],
): [T, (value: T) => void] {
  const searchParams = useSearchParams();
  const raw = searchParams.get(key);
  const value =
    raw !== null && (!allowed || (allowed as readonly string[]).includes(raw))
      ? (raw as T)
      : defaultValue;

  const setValue = (next: T) => {
    const params = new URLSearchParams(window.location.search);
    if (next === defaultValue || next === '') params.delete(key);
    else params.set(key, next);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  };

  return [value, setValue];
}
