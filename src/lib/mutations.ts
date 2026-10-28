import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import type { GameItem } from '@/lib/data/loaders';
import { updateGameStatus } from '@/lib/games/status';
import { applyStatusToList, statusChangeFrom, type StatusChange } from '@/lib/games/status-rules';

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

/** A status change from a game's detail dialog, where one date serves finished and dropped. */
export interface StatusEdit {
  gameId: number;
  status: string;
  date: string;
  notes: string;
  rating: number | null;
}

/**
 * Saves a status change from a detail dialog. The change shows at once in the
 * cached games list (any list fetch in flight is cancelled first, so it can't
 * land on top of it) and is undone if the save fails. Callers with another
 * cached view of the game add their own optimistic write with `apply` and
 * undo it in `rollback`.
 */
export function useSetGameStatus<V extends StatusEdit = StatusEdit, C = void>(
  userId: string | null,
  options: {
    /** Runs one at a time with other mutations in the same scope (e.g. the queue's). */
    scope?: { id: string };
    apply?: (vars: V) => C | Promise<C>;
    rollback?: (context: C | undefined) => void;
    /** Replaces the usual refresh, for a change only some queries show. */
    settle?: (vars: V) => void;
  } = {},
) {
  const queryClient = useQueryClient();
  const { statusChanged } = useInvalidateQueries();
  const gamesList = usePatchGamesList(userId);
  const { scope, apply, rollback, settle } = options;

  return useMutation({
    scope,
    mutationFn: (vars: V) =>
      updateGameStatus(vars.gameId, vars.status, {
        finishedAt: vars.status === 'finished' ? vars.date : undefined,
        droppedAt: vars.status === 'dropped' ? vars.date : undefined,
        notes: vars.notes,
        rating: vars.rating,
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.games.list(userId ?? '') });
      const extra = apply ? await apply(vars) : undefined;
      return { previousList: gamesList.patch(statusChangeFrom(vars)), extra };
    },
    onError: (err, _vars, context) => {
      console.error('Failed to update game status:', err);
      gamesList.restore(context?.previousList);
      rollback?.(context?.extra as C | undefined);
      toast.error('Could not save your changes. Please try again.');
    },
    onSettled: (_data, _error, vars) => (settle ? settle(vars) : statusChanged()),
  });
}
