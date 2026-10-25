'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { loadLibraryMeta } from '@/lib/data/loaders';

export function useLibraryMeta(userId: string | null) {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.library.meta(userId ?? ''),
    queryFn: () => loadLibraryMeta(createClient(), userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    gameCount: data?.gameCount ?? 0,
    historyCount: data?.historyCount ?? 0,
    loaded: !isPending && !!data,
  };
}
