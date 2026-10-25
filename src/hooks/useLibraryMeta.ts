'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';

interface LibraryMetaData {
  gameCount: number;
  historyCount: number;
}

async function fetchLibraryMeta(userId: string): Promise<LibraryMetaData> {
  const supabase = createClient();
  const [totalResult, historyResult] = await Promise.all([
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .neq('status', 'hidden'),
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'game')
      .in('status', ['finished', 'dropped']),
  ]);
  if (totalResult.error) throw totalResult.error;
  if (historyResult.error) throw historyResult.error;

  return {
    gameCount: totalResult.count ?? 0,
    historyCount: historyResult.count ?? 0,
  };
}

export function useLibraryMeta(userId: string | null) {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.library.meta(userId ?? ''),
    queryFn: () => fetchLibraryMeta(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    gameCount: data?.gameCount ?? 0,
    historyCount: data?.historyCount ?? 0,
    loaded: !isPending && !!data,
  };
}
