'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';

const neverChanges = () => () => {};

/**
 * Hands the queries a page loaded on the server (prefetchForUser) to the browser's
 * cache. Render it BEFORE the view, as a sibling:
 *
 *   <><PrefetchedQueries state={state} /><View /></>
 *
 * Unlike a plain HydrationBoundary, it delays a streamed query's data past the first
 * render. Data that arrived before the scripts ran would fill the cache at once, the
 * first render would not match the server's skeleton, and React would throw the
 * server's HTML away.
 */
export function PrefetchedQueries({ state }: { state: DehydratedState }) {
  // True on the server and for the browser's first render of a loaded page.
  const firstRender = useSyncExternalStore(
    neverChanges,
    () => false,
    () => true,
  );
  const hydrated = useMemo(
    () =>
      firstRender
        ? {
            ...state,
            queries: state.queries.map((query) =>
              query.promise ? { ...query, promise: Promise.resolve(query.promise) } : query,
            ),
          }
        : state,
    [state, firstRender],
  );
  return <HydrationBoundary state={hydrated} />;
}
