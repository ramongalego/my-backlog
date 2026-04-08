'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchQueuedAppIds } from '@/lib/games/queue';
import { queryKeys } from '@/lib/query-keys';

interface LibraryMetaData {
  gameCount: number;
  historyCount: number;
  queuedAppIds: Set<number>;
}

async function fetchLibraryMeta(userId: string): Promise<LibraryMetaData> {
  const supabase = createClient();
  const [{ count: total }, { count: finishedOrDropped }, queueIds] = await Promise.all([
    supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .neq('status', 'hidden'),
    supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .in('status', ['finished', 'dropped']),
    fetchQueuedAppIds(),
  ]);

  return {
    gameCount: total || 0,
    historyCount: finishedOrDropped ?? 0,
    queuedAppIds: queueIds,
  };
}

export function useLibraryMeta(userId: string | null) {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: queryKeys.library.meta(userId ?? ''),
    queryFn: () => fetchLibraryMeta(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const addQueuedAppId = useCallback(
    (appId: number) => {
      if (!userId) return;
      queryClient.setQueryData(
        queryKeys.library.meta(userId),
        (old: LibraryMetaData | undefined) => {
          if (!old) return old;
          return { ...old, queuedAppIds: new Set([...old.queuedAppIds, appId]) };
        },
      );
    },
    [userId, queryClient],
  );

  return {
    gameCount: data?.gameCount ?? 0,
    historyCount: data?.historyCount ?? 0,
    queuedAppIds: data?.queuedAppIds ?? new Set<number>(),
    addQueuedAppId,
    loaded: !isPending && !!data,
  };
}
