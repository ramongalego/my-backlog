'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addToQueue, removeFromQueue, reorderQueue } from '@/lib/client/queue';
import { queries } from '@/lib/data/queries';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/hooks/useGameMutations';
import { UNDO_MS } from '@/lib/undo';
import type { QueueItem } from '@/types/games';
import {
  QUEUE_SCOPE,
  QUEUE_UNDO_TOAST,
  toQueueItem,
  type QueueableGame,
} from '@/lib/games/queue-items';

/** The user's queue. The single cached source for queue items and "queued" badges. */
export function useQueue(userId: string | null) {
  const { data: queue = [], isPending, isLoadingError, refetch } = useQuery(queries.queue(userId));
  return {
    queue,
    queuedGameIds: new Set(queue.map((q) => q.game_id)),
    isLoading: !!userId && isPending,
    // The first load failed: show that, not an empty queue.
    loadError: isLoadingError,
    retry: () => void refetch(),
  };
}

/** Adds a game to the end of the queue, updating badges optimistically. */
export function useAddToQueue(userId: string | null) {
  const queryClient = useQueryClient();
  const { queue: invalidateQueue } = useInvalidateQueries();
  const queueKey = queryKeys.queue.list(userId ?? '');

  const mutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: (game: QueueableGame) => addToQueue(game.id),
    onMutate: async (game) => {
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previous = queryClient.getQueryData<QueueItem[]>(queueKey);
      queryClient.setQueryData<QueueItem[]>(queueKey, (old = []) =>
        old.some((q) => q.game_id === game.id) ? old : [...old, toQueueItem(game, old.length)],
      );
      return { previous };
    },
    onSuccess: (_data, game) => toast.success(`${game.name} added to the queue!`),
    onError: (err, game, context) => {
      console.error(err);
      if (context?.previous) queryClient.setQueryData(queueKey, context.previous);
      toast.error(`Could not add ${game.name} to the queue. Please try again.`);
    },
    onSettled: () => invalidateQueue(),
  });

  return (game: QueueableGame) => mutation.mutate(game);
}

/**
 * Takes a game off the queue (it stays in the backlog), with a toast that
 * offers Undo: back on the queue in its old place. From the queue page's
 * Move to backlog, and from choosing Backlog in a queued game's dialog.
 */
export function useRemoveFromQueue(userId: string | null) {
  const queryClient = useQueryClient();
  const { queue: invalidateQueue } = useInvalidateQueries();
  const queueKey = queryKeys.queue.list(userId ?? '');

  const snapshot = async () => {
    await queryClient.cancelQueries({ queryKey: queueKey });
    return { previousQueue: queryClient.getQueryData<QueueItem[]>(queueKey) };
  };
  const rollback = (context?: Awaited<ReturnType<typeof snapshot>>) => {
    if (context?.previousQueue !== undefined) {
      queryClient.setQueryData(queueKey, context.previousQueue);
    }
  };

  const removeMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: removeFromQueue,
    onMutate: async (gameId: number) => {
      const context = await snapshot();
      queryClient.setQueryData<QueueItem[]>(queueKey, (old) =>
        old?.filter((q) => q.game_id !== gameId),
      );
      return context;
    },
    onError: (err, _gameId, context) => {
      console.error(err);
      rollback(context);
      toast.error('Failed to remove game from queue');
    },
    // One quiet click: say where it went and offer to put it back where it was.
    onSuccess: (_data, gameId, context) => {
      const index = context?.previousQueue?.findIndex((q) => q.game_id === gameId) ?? -1;
      if (index === -1) return;
      const item = context!.previousQueue![index];
      // One Undo per removal, however many times it's clicked.
      let undone = false;
      toast(`Moved ${item.game.name} to your backlog`, {
        id: QUEUE_UNDO_TOAST,
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            if (undone) return;
            undone = true;
            restoreMutation.mutate({ item, index });
          },
        },
      });
    },
    onSettled: () => invalidateQueue(),
  });

  // Undo: back on the queue, in its old place (or last, if the queue has
  // shrunk since). Only that game: anything else that changed meanwhile stays.
  const restoreMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: async ({ item, index }: { item: QueueItem; index: number }) => {
      // The server adds it last; move it up unless last is where it was.
      await addToQueue(item.game_id);
      const rest = (queryClient.getQueryData<QueueItem[]>(queueKey) ?? [])
        .map((q) => q.game_id)
        .filter((id) => id !== item.game_id);
      if (index < rest.length) {
        rest.splice(index, 0, item.game_id);
        await reorderQueue(rest);
      }
    },
    onMutate: async ({ item, index }) => {
      const context = await snapshot();
      queryClient.setQueryData<QueueItem[]>(queueKey, (old = []) => {
        const rest = old.filter((q) => q.game_id !== item.game_id);
        rest.splice(Math.min(index, rest.length), 0, item);
        return rest.map((q, i) => ({ ...q, position: i }));
      });
      return context;
    },
    onError: (err, _vars, context) => {
      console.error(err);
      rollback(context);
      toast.error("Couldn't put the game back in your queue");
    },
    onSettled: () => invalidateQueue(),
  });

  return (gameId: number) => removeMutation.mutate(gameId);
}
