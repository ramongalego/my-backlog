import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { GameItem } from '@/lib/data/loaders';
import { applyStatusToList, type StatusChange } from '@/lib/games/status-rules';

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
     * Invalidate after a status change whose effect on the games list was
     * already applied in place (usePatchGamesList). Refreshes everything else
     * it touches: the playing game, the diary, counts, carousels (a game that
     * leaves the backlog drops out of them) and the queue (the status route
     * dequeues games that leave the backlog). The list itself isn't
     * refetched, so a big library isn't downloaded again for one edit.
     */
    statusChanged: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.games.all,
        predicate: (query) => query.queryKey[1] !== 'list',
      });
      invalidate(queryKeys.library.all, queryKeys.carousels.all, queryKeys.queue.all);
    },
    /**
     * Invalidate after a queue-only change. "Queued" badges and the carousels'
     * queued-game filter both read the queue query directly.
     */
    queue: () => invalidate(queryKeys.queue.all),
    /** Invalidate everything, list included, after the library itself changed (sync, playtime refresh). */
    gamesAndQueue: () =>
      invalidate(
        queryKeys.games.all,
        queryKeys.queue.all,
        queryKeys.library.all,
        queryKeys.carousels.all,
      ),
  };
}

/**
 * Applies status changes to the cached games list (shared by the Games page
 * and Stats) the same way the server applies them, so the list never has to
 * be downloaded again after an edit. `patch` returns what to hand `restore`
 * if the request fails.
 */
export function usePatchGamesList(userId: string | null) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.games.list(userId ?? '');

  return {
    patch: (...changes: StatusChange[]) => {
      const previous = queryClient.getQueryData<GameItem[]>(listKey);
      queryClient.setQueryData<GameItem[]>(
        listKey,
        (old) => old && changes.reduce((list, change) => applyStatusToList(list, change), old),
      );
      return previous;
    },
    restore: (previous: GameItem[] | undefined) => {
      if (previous) queryClient.setQueryData(listKey, previous);
    },
  };
}
