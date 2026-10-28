'use client';

import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';

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
