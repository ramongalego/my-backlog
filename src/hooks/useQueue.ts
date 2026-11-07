'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addToQueue } from '@/lib/client/queue';
import { queries } from '@/lib/data/queries';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/hooks/useGameMutations';
import type { QueueItem } from '@/types/games';
import { QUEUE_SCOPE, toQueueItem, type QueueableGame } from '@/lib/games/queue-items';

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
