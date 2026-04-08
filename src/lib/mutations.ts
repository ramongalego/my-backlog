import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/lib/query-keys';

/**
 * Returns a callback that invalidates all game-related queries.
 * Call after any mutation that changes game status, diary, stats, etc.
 */
export function useInvalidateGameQueries() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.games.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.queue.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
  }, [queryClient]);
}
