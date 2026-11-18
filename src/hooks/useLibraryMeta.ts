'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import { queryKeys } from '@/lib/query-keys';
import type { LibraryMeta } from '@/lib/data/loaders';
import type { LibraryPlatforms } from '@/lib/games/consoles';
import { useAuth } from './useAuth';

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
 * Without fetching (the app layout caches them for the header), so a skeleton
 * doesn't draw a grid for an empty library. Undefined when not known yet.
 */
export function useCachedLibraryMeta(): LibraryMeta | undefined {
  return useQueryClient()
    .getQueriesData<LibraryMeta>({ queryKey: queryKeys.library.all })
    .map(([, data]) => data)
    .find((data) => data !== undefined);
}

/**
 * For `platformToSay` and `platformTag`: null until known, which those take as
 * "say only consoles".
 */
export function useLibraryPlatforms(): LibraryPlatforms | null {
  const userId = useAuth().user?.id ?? null;
  const { data } = useQuery(queries.libraryMeta(userId));
  return data?.platforms ?? null;
}
