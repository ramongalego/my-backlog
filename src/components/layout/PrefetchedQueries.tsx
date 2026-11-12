'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';

const neverChanges = () => () => {};

/**
 * Hands the queries a page loaded on the server (prefetchForUser) to the
 * browser's cache. Render it BEFORE the view, as a sibling:
 *
 *   <><PrefetchedQueries state={state} /><View /></>
 *
 * It is a HydrationBoundary with one difference, for queries that are streamed
 * (still loading when the page is sent). The server renders those as loading.
 * In the browser the data may already have arrived by the time the page's
 * scripts run (a first visit, when they aren't cached yet), and the cache
 * would then start with the data in place: the browser's first render would
 * be the finished page where the server's HTML was the skeleton. React treats
 * that as a failed hydration, throws the server's HTML away and logs an error.
 *
 * So for that first render only, a streamed result is passed on as a promise
 * that resolves just after it: the browser renders the skeleton the server
 * did, and the data shows a moment later. Moving between pages is unchanged.
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
