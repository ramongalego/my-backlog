import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

/**
 * Returns targeted invalidation functions for specific query groups.
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  const invalidate = (...keys: (readonly string[])[]) => {
    for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
  };

  return {
    /**
     * Invalidate after a status change. Covers carousels (a game that leaves
     * the backlog must drop out of them) and the queue (the status route
     * dequeues games that leave the backlog).
     */
    games: () =>
      invalidate(
        queryKeys.games.all,
        queryKeys.library.all,
        queryKeys.carousels.all,
        queryKeys.queue.all,
      ),
    /**
     * Invalidate after a queue-only change. "Queued" badges read the queue
     * query directly; the carousels leave queued games out.
     */
    queue: () => invalidate(queryKeys.queue.all, queryKeys.carousels.all),
    /** Invalidate games + queue + carousels (after pick/cancel or library refresh) */
    gamesAndQueue: () =>
      invalidate(
        queryKeys.games.all,
        queryKeys.queue.all,
        queryKeys.library.all,
        queryKeys.carousels.all,
      ),
  };
}
