import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

/**
 * Returns a callback that invalidates all game-related queries.
 * Call after any mutation that changes game status, diary, stats, etc.
 */
export function useInvalidateGameQueries() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.games.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.queue.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
  };
}

/**
 * Returns targeted invalidation functions for specific query groups.
 * Use these instead of the blanket invalidateGameQueries where possible.
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    /** Invalidate game list + stats + diary (after status change) */
    games: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.games.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
    /** Invalidate only the queue list */
    queue: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.all });
    },
    /** Invalidate games + queue (after pick/cancel that affects both) */
    gamesAndQueue: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.games.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  };
}
