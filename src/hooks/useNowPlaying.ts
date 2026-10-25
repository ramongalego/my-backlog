'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { celebrateGameFinished } from '@/lib/confetti';
import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';
import { addToQueue, fetchQueue, removeFromQueue, reorderQueue } from '@/lib/games/queue';
import { fetchCurrentlyPlaying } from '@/lib/games/currentGame';
import { updateGameStatus } from '@/lib/games/status';
import { fetchCompletionCounts, buildCompletionSummary } from '@/lib/games/completion';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/lib/mutations';
import { removeAppFromPools, type CarouselPools } from './useCarouselPools';
import type { GameWithImage, QueueItem } from '@/types/games';
import type { GameSummaryData } from '@/components/games/GameSummaryModal';

// Every mutation here touches the queue and/or the playing game. Sharing a
// scope makes React Query run them one at a time, so e.g. two quick reorders
// can't reach the server out of order or roll back over each other.
const QUEUE_SCOPE = { id: 'queue' };

/** Minimal game data needed to show a game in the queue before the server responds. */
export type QueueableGame = Pick<
  GameWithImage,
  'app_id' | 'name' | 'header_image' | 'main_story_hours' | 'playtime_forever'
> &
  Partial<Pick<GameWithImage, 'steam_review_score' | 'deck_compat'>>;

function toQueueItem(game: QueueableGame, position: number): QueueItem {
  return {
    id: -game.app_id,
    app_id: game.app_id,
    position,
    game: {
      name: game.name,
      header_image: game.header_image,
      playtime_forever: game.playtime_forever,
      main_story_hours: game.main_story_hours,
      steam_review_score: game.steam_review_score ?? null,
      deck_compat: game.deck_compat ?? null,
    },
  };
}

function toPlayingGame(item: QueueItem): GameWithImage {
  return {
    app_id: item.app_id,
    name: item.game.name,
    header_image: item.game.header_image,
    main_story_hours: item.game.main_story_hours,
    playtime_forever: item.game.playtime_forever,
    started_at: null,
    steam_review_score: item.game.steam_review_score,
    deck_compat: item.game.deck_compat ?? null,
  };
}

/** The user's queue. The single cached source for queue items and "queued" badges. */
export function useQueue(userId: string | null) {
  const { data: queue = [], isPending } = useQuery({
    queryKey: queryKeys.queue.list(userId ?? ''),
    queryFn: fetchQueue,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
  return {
    queue,
    queuedAppIds: new Set(queue.map((q) => q.app_id)),
    isLoading: !!userId && isPending,
  };
}

/** Adds a game to the end of the queue, updating badges optimistically. */
export function useAddToQueue(userId: string | null) {
  const queryClient = useQueryClient();
  const { queue: invalidateQueue } = useInvalidateQueries();
  const queueKey = queryKeys.queue.list(userId ?? '');

  const mutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: (game: QueueableGame) => addToQueue(game.app_id),
    onMutate: async (game) => {
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previous = queryClient.getQueryData<QueueItem[]>(queueKey);
      queryClient.setQueryData<QueueItem[]>(queueKey, (old = []) =>
        old.some((q) => q.app_id === game.app_id) ? old : [...old, toQueueItem(game, old.length)],
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

type CompletionStatus = 'finished' | 'dropped';

interface CompleteInput {
  game: GameWithImage;
  status: string;
  date: string;
  notes: string;
  rating: number | null;
}

/**
 * The currently playing game, the queue, and every action on them. Shared by
 * the home page and the playing-queue page so both behave identically.
 */
export function useNowPlaying(userId: string | null) {
  const queryClient = useQueryClient();
  const { gamesAndQueue: invalidateAll, queue: invalidateQueue } = useInvalidateQueries();
  const playingKey = queryKeys.games.playing(userId ?? '');
  const queueKey = queryKeys.queue.list(userId ?? '');

  const [statusModal, setStatusModal] = useState<{ action: CompletionStatus } | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);

  const { data: currentlyPlaying = null, isPending: playingPending } = useQuery({
    queryKey: playingKey,
    queryFn: () => fetchCurrentlyPlaying(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
  const { queue, queuedAppIds, isLoading: queueLoading } = useQueue(userId);
  const addGameToQueue = useAddToQueue(userId);

  // Snapshot + optimistic write helpers shared by the mutations below.
  const snapshot = async () => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: playingKey }),
      queryClient.cancelQueries({ queryKey: queueKey }),
    ]);
    return {
      previousPlaying: queryClient.getQueryData<GameWithImage | null>(playingKey),
      previousQueue: queryClient.getQueryData<QueueItem[]>(queueKey),
    };
  };
  const rollback = (context?: Awaited<ReturnType<typeof snapshot>>) => {
    if (!context) return;
    if (context.previousPlaying !== undefined) {
      queryClient.setQueryData(playingKey, context.previousPlaying);
    }
    if (context.previousQueue !== undefined) {
      queryClient.setQueryData(queueKey, context.previousQueue);
    }
  };
  const dropFromQueue = (appId: number) =>
    queryClient.setQueryData<QueueItem[]>(queueKey, (old) =>
      old?.filter((q) => q.app_id !== appId),
    );

  const pickMutation = useMutation({
    scope: QUEUE_SCOPE,
    // The status route also takes the game off the queue if it was queued.
    mutationFn: (game: GameWithImage) => updateGameStatus(game.app_id, 'playing'),
    onMutate: async (game) => {
      const context = await snapshot();
      queryClient.setQueryData(playingKey, game);
      dropFromQueue(game.app_id);
      // Carousels are refetched on settle, so they don't need a rollback.
      queryClient.setQueriesData<CarouselPools>(
        { queryKey: queryKeys.carousels.all },
        (pools) => pools && removeAppFromPools(pools, game.app_id),
      );
      return context;
    },
    onError: (err, _game, context) => {
      console.error('Failed to pick game:', err);
      rollback(context);
      toast.error('Failed to start playing');
    },
    onSettled: () => invalidateAll(),
  });

  const completeMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: async ({ game, status, date, notes, rating }: CompleteInput) => {
      await updateGameStatus(game.app_id, status, {
        finishedAt: status === 'finished' ? date : undefined,
        droppedAt: status === 'dropped' ? date : undefined,
        notes,
        rating,
      });

      // The finish/drop is saved; the follow-ups are best-effort so a failed
      // promote doesn't report the whole action as failed.
      const supabase = createClient();
      const [countsResult, promotedResult] = await Promise.allSettled([
        fetchCompletionCounts(supabase, userId!),
        promoteNextFromQueue(userId!, supabase),
      ]);
      if (promotedResult.status === 'rejected') {
        console.error('Failed to start next queued game:', promotedResult.reason);
      }
      return {
        counts:
          countsResult.status === 'fulfilled'
            ? countsResult.value
            : { gamesFinished: 0, totalGames: 0 },
        promoted: promotedResult.status === 'fulfilled' ? promotedResult.value : null,
        promoteFailed: promotedResult.status === 'rejected',
      };
    },
    onSuccess: ({ counts, promoted, promoteFailed }, { game, status, rating }) => {
      if (promoteFailed) toast.error("Couldn't start the next game from your queue.");
      queryClient.setQueryData(playingKey, promoted);
      if (promoted) dropFromQueue(promoted.app_id);
      if (status === 'finished') {
        setGameSummary(buildCompletionSummary({ finishedGame: game, promoted, counts, rating }));
        celebrateGameFinished();
      }
    },
    onError: (err, { status }) => {
      console.error(`Failed to set game to ${status}:`, err);
      toast.error('Could not update the game. Please try again.');
    },
    onSettled: () => invalidateAll(),
  });

  const moveToQueueMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: async (game: GameWithImage) => {
      await updateGameStatus(game.app_id, 'backlog');
      await addToQueue(game.app_id);
    },
    onMutate: async (game) => {
      const context = await snapshot();
      queryClient.setQueryData(playingKey, null);
      queryClient.setQueryData<QueueItem[]>(queueKey, (old = []) => [
        ...old,
        toQueueItem(game, old.length),
      ]);
      return context;
    },
    onError: (err, _game, context) => {
      console.error('Failed to move game to queue:', err);
      rollback(context);
      toast.error('Failed to move game to queue');
    },
    // Refetch either way: the first step may have succeeded before the second failed.
    onSettled: () => invalidateAll(),
  });

  const moveToBacklogMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: (game: GameWithImage) => updateGameStatus(game.app_id, 'backlog'),
    onMutate: async () => {
      const context = await snapshot();
      queryClient.setQueryData(playingKey, null);
      return context;
    },
    onError: (err, _game, context) => {
      console.error('Failed to move game to backlog:', err);
      rollback(context);
      toast.error('Failed to move game to backlog');
    },
    onSettled: () => invalidateAll(),
  });

  const removeMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: removeFromQueue,
    onMutate: async (appId: number) => {
      const context = await snapshot();
      dropFromQueue(appId);
      return context;
    },
    onError: (err, _appId, context) => {
      console.error(err);
      rollback(context);
      toast.error('Failed to remove game from queue');
    },
    onSettled: () => invalidateQueue(),
  });

  const reorderMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: reorderQueue,
    onMutate: async (appIds: number[]) => {
      const context = await snapshot();
      queryClient.setQueryData<QueueItem[]>(queueKey, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((q) => [q.app_id, q]));
        // Unknown id means the cache and the drag state diverged; skip the
        // optimistic pass and let the refetch catch up.
        if (!appIds.every((id) => byId.has(id))) return old;
        return appIds.map((id, i) => ({ ...byId.get(id)!, position: i }));
      });
      return context;
    },
    onError: (err, _appIds, context) => {
      console.error(err);
      rollback(context);
      toast.error('Failed to reorder queue');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queueKey }),
  });

  const isStatusLoading =
    pickMutation.isPending ||
    completeMutation.isPending ||
    moveToQueueMutation.isPending ||
    moveToBacklogMutation.isPending;

  return {
    currentlyPlaying,
    queue,
    queuedAppIds,
    isLoading: !!userId && (playingPending || queueLoading),
    isStatusLoading,

    statusModal,
    gameSummary,
    openFinish: () => currentlyPlaying && setStatusModal({ action: 'finished' }),
    openDrop: () => currentlyPlaying && setStatusModal({ action: 'dropped' }),
    closeStatusModal: () => setStatusModal(null),
    closeSummary: () => setGameSummary(null),
    confirmStatusChange: (status: string, date: string, notes: string, rating: number | null) => {
      if (!currentlyPlaying) return;
      setStatusModal(null);
      completeMutation.mutate({ game: currentlyPlaying, status, date, notes, rating });
    },

    pick: (game: GameWithImage) => pickMutation.mutateAsync(game).catch(() => undefined),
    pickFromQueue: (appId: number) => {
      const item = queue.find((q) => q.app_id === appId);
      if (item) pickMutation.mutate(toPlayingGame(item));
    },
    moveToQueue: () => currentlyPlaying && moveToQueueMutation.mutate(currentlyPlaying),
    moveToBacklog: () => currentlyPlaying && moveToBacklogMutation.mutate(currentlyPlaying),
    addToQueue: addGameToQueue,
    removeFromQueue: (appId: number) => removeMutation.mutate(appId),
    reorder: (appIds: number[]) => reorderMutation.mutate(appIds),
  };
}
