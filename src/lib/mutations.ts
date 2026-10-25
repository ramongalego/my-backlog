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
     * Invalidate after a queue change (add/remove). Also invalidates games +
     * library because `queuedAppIds` is packaged inside the games.list and
     * library.meta queries, so removing/adding to the queue must refresh them
     * to keep "queued" badges accurate.
     */
    queue: () => invalidate(queryKeys.queue.all, queryKeys.games.all, queryKeys.library.all),
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
