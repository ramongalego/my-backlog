'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { celebrateGameFinished } from '@/lib/confetti';
import { addToQueue, removeFromQueue, reorderQueue } from '@/lib/games/queue';
import { loadCurrentlyPlaying, loadQueue } from '@/lib/data/loaders';
import { completeGame, updateGameStatus } from '@/lib/games/status';
import { buildCompletionSummary } from '@/lib/games/completion';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries, usePatchGamesList } from '@/lib/mutations';
import { statusChangeFrom, type StatusChange } from '@/lib/games/status-rules';
import { removeGameFromPools, type CarouselPools } from './useCarouselPools';
import type { GameWithImage, QueueItem } from '@/types/games';
import type { GameSummaryData } from '@/components/games/GameSummaryModal';

// Every mutation here touches the queue and/or the playing game. Sharing a
// scope makes React Query run them one at a time, so e.g. two quick reorders
// can't reach the server out of order or roll back over each other.
interface QueuedStatusChange {
  gameId: number;
  status: string;
  date: string;
  notes: string;
  rating: number | null;
}

const QUEUE_SCOPE = { id: 'queue' };

/** Minimal game data needed to show a game in the queue before the server responds. */
export type QueueableGame = Pick<
  GameWithImage,
  'id' | 'app_id' | 'name' | 'header_image' | 'main_story_hours' | 'playtime_forever'
> &
  Partial<
    Pick<
      GameWithImage,
      | 'steam_review_score'
      | 'steam_review_count'
      | 'critic_score'
      | 'critic_count'
      | 'deck_compat'
      | 'last_played_at'
      | 'release_date'
      | 'source'
      | 'platform'
    >
  >;

function toQueueItem(game: QueueableGame, position: number): QueueItem {
  return {
    id: -game.id,
    game_id: game.id,
    position,
    game: {
      app_id: game.app_id,
      name: game.name,
      header_image: game.header_image,
      playtime_forever: game.playtime_forever,
      main_story_hours: game.main_story_hours,
      steam_review_score: game.steam_review_score ?? null,
      steam_review_count: game.steam_review_count ?? null,
      critic_score: game.critic_score ?? null,
      critic_count: game.critic_count ?? null,
      deck_compat: game.deck_compat ?? null,
      last_played_at: game.last_played_at ?? null,
      release_date: game.release_date ?? null,
      // The console tag and Steam details depend on these.
      source: game.source,
      platform: game.platform,
    },
  };
}

function toPlayingGame(item: QueueItem): GameWithImage {
  return {
    id: item.game_id,
    app_id: item.game.app_id,
    name: item.game.name,
    header_image: item.game.header_image,
    main_story_hours: item.game.main_story_hours,
    playtime_forever: item.game.playtime_forever,
    started_at: null,
    steam_review_score: item.game.steam_review_score,
    steam_review_count: item.game.steam_review_count ?? null,
    critic_score: item.game.critic_score ?? null,
    critic_count: item.game.critic_count ?? null,
    deck_compat: item.game.deck_compat ?? null,
    last_played_at: item.game.last_played_at ?? null,
    release_date: item.game.release_date ?? null,
    source: item.game.source,
    platform: item.game.platform,
  };
}

/** The user's queue. The single cached source for queue items and "queued" badges. */
export function useQueue(userId: string | null) {
  const { data: queue = [], isPending } = useQuery({
    queryKey: queryKeys.queue.list(userId ?? ''),
    // Straight from the database like every other query (and the same loader
    // the server prefetch uses), not through /api/queue, which added a hop.
    queryFn: () => loadQueue(createClient(), userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
  return {
    queue,
    queuedGameIds: new Set(queue.map((q) => q.game_id)),
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
  const { statusChanged, queue: invalidateQueue } = useInvalidateQueries();
  const gamesList = usePatchGamesList(userId);
  const playingKey = queryKeys.games.playing(userId ?? '');
  const queueKey = queryKeys.queue.list(userId ?? '');

  const [statusModal, setStatusModal] = useState<{ action: CompletionStatus } | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);

  const { data: currentlyPlaying = null, isPending: playingPending } = useQuery({
    queryKey: playingKey,
    queryFn: () => loadCurrentlyPlaying(createClient(), userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
  const { queue, queuedGameIds, isLoading: queueLoading } = useQueue(userId);
  const addGameToQueue = useAddToQueue(userId);

  // Snapshot + optimistic write helpers shared by the mutations below. The
  // status changes are applied to the cached games list (Games page, Stats)
  // the way the server applies them, instead of refetching the whole list.
  const snapshot = async (...changes: StatusChange[]) => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: playingKey }),
      queryClient.cancelQueries({ queryKey: queueKey }),
    ]);
    return {
      previousPlaying: queryClient.getQueryData<GameWithImage | null>(playingKey),
      previousQueue: queryClient.getQueryData<QueueItem[]>(queueKey),
      previousList: changes.length ? gamesList.patch(...changes) : undefined,
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
    gamesList.restore(context.previousList);
  };
  const dropFromQueue = (gameId: number) =>
    queryClient.setQueryData<QueueItem[]>(queueKey, (old) =>
      old?.filter((q) => q.game_id !== gameId),
    );

  const pickMutation = useMutation({
    scope: QUEUE_SCOPE,
    // The status route also takes the game off the queue if it was queued.
    mutationFn: (game: GameWithImage) => updateGameStatus(game.id, 'playing'),
    onMutate: async (game) => {
      const context = await snapshot({ gameId: game.id, status: 'playing' });
      queryClient.setQueryData(playingKey, game);
      dropFromQueue(game.id);
      // Carousels are refetched on settle, so they don't need a rollback.
      queryClient.setQueriesData<CarouselPools>(
        { queryKey: queryKeys.carousels.all },
        (pools) => pools && removeGameFromPools(pools, game.id),
      );
      return context;
    },
    onError: (err, _game, context) => {
      console.error('Failed to pick game:', err);
      rollback(context);
      toast.error('Failed to start playing');
    },
    onSettled: () => statusChanged(),
  });

  const completeMutation = useMutation({
    scope: QUEUE_SCOPE,
    // One request saves the finish/drop, counts the library and starts the
    // next queued game (the promote is best-effort and reported separately).
    mutationFn: ({ game, status, date, notes, rating }: CompleteInput) =>
      completeGame(game.id, status as 'finished' | 'dropped', { date, notes, rating }),
    onSuccess: ({ counts, promoted, promoteFailed }, { game, status, date, notes, rating }) => {
      if (promoteFailed) toast.error("Couldn't start the next game from your queue.");
      gamesList.patch(
        statusChangeFrom({ gameId: game.id, status, date, notes, rating }),
        ...(promoted ? [{ gameId: promoted.id, status: 'playing' as const }] : []),
      );
      queryClient.setQueryData(playingKey, promoted);
      if (promoted) dropFromQueue(promoted.id);
      if (status === 'finished') {
        setGameSummary(buildCompletionSummary({ finishedGame: game, promoted, counts, rating }));
        celebrateGameFinished();
      }
    },
    onError: (err, { status }) => {
      console.error(`Failed to set game to ${status}:`, err);
      toast.error('Could not update the game. Please try again.');
    },
    onSettled: () => statusChanged(),
  });

  // Moving the playing game away takes it off Home in one click on a quiet
  // link, so say where it went and offer to bring it back (starting it again
  // also takes it off the queue).
  const offerUndo = (game: GameWithImage, where: 'queue' | 'backlog') =>
    toast(`Moved ${game.name} to your ${where}`, {
      action: { label: 'Undo', onClick: () => pickMutation.mutate(game) },
    });

  const moveToQueueMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: async (game: GameWithImage) => {
      await updateGameStatus(game.id, 'backlog');
      await addToQueue(game.id);
    },
    onMutate: async (game) => {
      const context = await snapshot({ gameId: game.id, status: 'backlog' });
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
    onSuccess: (_data, game) => offerUndo(game, 'queue'),
    // Refetch either way: the first step may have succeeded before the second failed.
    onSettled: () => statusChanged(),
  });

  const moveToBacklogMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: (game: GameWithImage) => updateGameStatus(game.id, 'backlog'),
    onMutate: async (game) => {
      const context = await snapshot({ gameId: game.id, status: 'backlog' });
      queryClient.setQueryData(playingKey, null);
      return context;
    },
    onError: (err, _game, context) => {
      console.error('Failed to move game to backlog:', err);
      rollback(context);
      toast.error('Failed to move game to backlog');
    },
    onSuccess: (_data, game) => offerUndo(game, 'backlog'),
    onSettled: () => statusChanged(),
  });

  // A queued game's status set from its detail dialog. The queue only holds
  // backlog games, so any other status takes it off (the server does the same).
  const queuedStatusMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: (vars: QueuedStatusChange) =>
      updateGameStatus(vars.gameId, vars.status, {
        finishedAt: vars.status === 'finished' ? vars.date : undefined,
        droppedAt: vars.status === 'dropped' ? vars.date : undefined,
        notes: vars.notes,
        rating: vars.rating,
      }),
    onMutate: async (vars) => {
      const context = await snapshot(statusChangeFrom(vars));
      if (vars.status !== 'backlog') dropFromQueue(vars.gameId);
      return context;
    },
    onError: (err, _change, context) => {
      console.error('Failed to update game status:', err);
      rollback(context);
      toast.error('Could not save your changes. Please try again.');
    },
    onSettled: () => statusChanged(),
  });

  const removeMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: removeFromQueue,
    onMutate: async (gameId: number) => {
      const context = await snapshot();
      dropFromQueue(gameId);
      return context;
    },
    onError: (err, _gameId, context) => {
      console.error(err);
      rollback(context);
      toast.error('Failed to remove game from queue');
    },
    // Like moving the playing game away, one quiet click: say where it went
    // and offer to put it back where it was.
    onSuccess: (_data, gameId, context) => {
      const index = context?.previousQueue?.findIndex((q) => q.game_id === gameId) ?? -1;
      if (index === -1) return;
      const item = context!.previousQueue![index];
      toast(`Moved ${item.game.name} to your backlog`, {
        action: { label: 'Undo', onClick: () => restoreMutation.mutate({ item, index }) },
      });
    },
    onSettled: () => invalidateQueue(),
  });

  // Undo for taking a game off the queue: back on it, in its old place (or
  // last, if the queue has shrunk since). Only that game: anything else that
  // changed meanwhile stays as it is.
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

  const reorderMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: reorderQueue,
    onMutate: async (gameIds: number[]) => {
      const context = await snapshot();
      queryClient.setQueryData<QueueItem[]>(queueKey, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((q) => [q.game_id, q]));
        // Unknown id means the cache and the drag state diverged; skip the
        // optimistic pass and let the refetch catch up.
        if (!gameIds.every((id) => byId.has(id))) return old;
        return gameIds.map((id, i) => ({ ...byId.get(id)!, position: i }));
      });
      return context;
    },
    onError: (err, _gameIds, context) => {
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
    moveToBacklogMutation.isPending ||
    queuedStatusMutation.isPending;

  return {
    currentlyPlaying,
    queue,
    queuedGameIds,
    isLoading: !!userId && (playingPending || queueLoading),
    isStatusLoading,

    statusModal,
    gameSummary,
    openFinish: () => currentlyPlaying && setStatusModal({ action: 'finished' }),
    openDrop: () => currentlyPlaying && setStatusModal({ action: 'dropped' }),
    closeStatusModal: () => setStatusModal(null),
    closeSummary: () => setGameSummary(null),
    confirmStatusChange: (status: string, date: string, notes: string, rating: number | null) => {
      // The cached game, not the one this render saw: the dialog may have just
      // saved new hours, which the completion summary should show.
      const game = queryClient.getQueryData<GameWithImage | null>(playingKey) ?? currentlyPlaying;
      if (!game) return;
      setStatusModal(null);
      completeMutation.mutate({ game, status, date, notes, rating });
    },

    pick: (game: GameWithImage) => pickMutation.mutateAsync(game).catch(() => undefined),
    pickFromQueue: (gameId: number) => {
      const item = queue.find((q) => q.game_id === gameId);
      if (item) pickMutation.mutate(toPlayingGame(item));
    },
    moveToQueue: () => currentlyPlaying && moveToQueueMutation.mutate(currentlyPlaying),
    moveToBacklog: () => currentlyPlaying && moveToBacklogMutation.mutate(currentlyPlaying),
    addToQueue: addGameToQueue,
    removeFromQueue: (gameId: number) => removeMutation.mutate(gameId),
    /** A queued game's status from its detail dialog; playing starts it like Play does. */
    setQueuedStatus: (vars: QueuedStatusChange) => {
      const item = queue.find((q) => q.game_id === vars.gameId);
      if (vars.status === 'playing') {
        if (item) pickMutation.mutate(toPlayingGame(item));
      } else if (vars.status !== 'backlog') {
        queuedStatusMutation.mutate(vars);
      }
    },
    reorder: (gameIds: number[]) => reorderMutation.mutate(gameIds),
  };
}
