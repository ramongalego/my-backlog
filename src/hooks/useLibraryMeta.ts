'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import { queryKeys } from '@/lib/query-keys';
import type { LibraryMeta } from '@/lib/data/loaders';

export function useLibraryMeta(userId: string | null) {
  const { data, isPending, isLoadingError, refetch } = useQuery(queries.libraryMeta(userId));

  return {
    gameCount: data?.gameCount ?? 0,
    historyCount: data?.historyCount ?? 0,
    backlogCount: data?.backlogCount ?? 0,
    loaded: !isPending && !!data,
    loadError: isLoadingError,
    retry: () => void refetch(),
  };
}

/**
 * The library's counts if they're already cached (the app layout loads them
 * for the header), without fetching: for loading skeletons, which then don't
 * draw a grid for a library that's empty. Undefined when not known yet.
 */
export function useCachedLibraryMeta(): LibraryMeta | undefined {
  return useQueryClient()
    .getQueriesData<LibraryMeta>({ queryKey: queryKeys.library.all })
    .map(([, data]) => data)
    .find((data) => data !== undefined);
}
