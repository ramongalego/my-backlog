'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { celebrateGameFinished } from '@/lib/confetti';
import { addToQueue, reorderQueue } from '@/lib/client/queue';
import type { LibraryMeta } from '@/lib/data/loaders';
import { queries } from '@/lib/data/queries';
import { completeGame, updateGameStatus } from '@/lib/client/game-status';
import { buildCompletionSummary, type GameSummaryData } from '@/lib/games/completion';
import { queryKeys } from '@/lib/query-keys';
import { UNDO_MS } from '@/lib/undo';
import { nextPlayable } from '@/lib/games/release-date';
import {
  useInvalidateQueries,
  usePatchGamesList,
  useSetGameStatus,
  type StatusEdit,
} from '@/hooks/useGameMutations';
import { statusChangeFrom, type StatusChange } from '@/lib/games/status-rules';
import { removeGameFromPools, type CarouselPools } from '@/hooks/useCarouselPools';
import type { GameWithImage, QueueItem } from '@/types/games';
import { useSwitchGame } from '@/hooks/useSwitchGame';
import { QUEUE_SCOPE, fromQueueItem, toPlayingGame, toQueueItem } from '@/lib/games/queue-items';
import { useAddToQueue, useQueue, useRemoveFromQueue } from '@/hooks/useQueue';
import type { GameStatus } from '@/lib/games/status';

type CompletionStatus = 'finished' | 'dropped';

interface CompleteInput {
  game: GameWithImage;
  status: CompletionStatus;
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
  const { statusChanged } = useInvalidateQueries();
  const gamesList = usePatchGamesList(userId);
  const playingKey = queryKeys.games.playing(userId ?? '');
  const queueKey = queryKeys.queue.list(userId ?? '');

  const [statusModal, setStatusModal] = useState<{ action: CompletionStatus } | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);

  const {
    data: currentlyPlaying = null,
    isPending: playingPending,
    isLoadingError: playingError,
    refetch: refetchPlaying,
  } = useQuery(queries.playing(userId));
  const {
    queue,
    queuedGameIds,
    isLoading: queueLoading,
    loadError: queueError,
    retry: retryQueue,
  } = useQueue(userId);
  const addGameToQueue = useAddToQueue(userId);
  const removeGameFromQueue = useRemoveFromQueue(userId);

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
      completeGame(game.id, status, { date, notes, rating }),
    onSuccess: ({ counts, promoted, promoteFailed }, { game, status, date, notes, rating }) => {
      if (promoteFailed) toast.error("Couldn't start the next game from your queue.");
      gamesList.patch(
        statusChangeFrom({ gameId: game.id, status, date, notes, rating }),
        ...(promoted ? [{ gameId: promoted.id, status: 'playing' as const }] : []),
      );
      queryClient.setQueryData(playingKey, promoted);
      if (promoted) dropFromQueue(promoted.id);
      // The summary opened as soon as it was saved (confirmStatusChange); the
      // server's counts and next game replace the estimate, unless it's been
      // closed by now.
      if (status === 'finished') {
        const summary = buildCompletionSummary({
          finishedGame: game,
          promoted,
          counts,
          rating,
          finishedAt: date,
        });
        setGameSummary((open) => open && summary);
      }
    },
    onError: (err, { status }) => {
      console.error(`Failed to set game to ${status}:`, err);
      // It isn't finished after all.
      setGameSummary(null);
      toast.error('Could not update the game. Please try again.');
    },
    onSettled: () => statusChanged(),
  });

  // Moving the playing game away takes it off Home in one click on a quiet
  // link, so say where it went and offer to bring it back (starting it again
  // also takes it off the queue).
  const offerUndo = (game: GameWithImage, where: 'queue' | 'backlog') =>
    toast(`Moved ${game.name} to your ${where}`, {
      duration: UNDO_MS,
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

  // Play on a queued game while another is playing switches to it.
  const switchGame = useSwitchGame(userId);

  // A queued game's status set from its detail dialog. The queue only holds
  // backlog games, so any other status takes it off (the server does the same).
  const queuedStatusMutation = useSetGameStatus(userId, {
    scope: QUEUE_SCOPE,
    apply: async (vars) => {
      const context = await snapshot();
      if (vars.status !== 'backlog') dropFromQueue(vars.gameId);
      return context;
    },
    rollback,
  });

  // The new order shows at once (see `reorder` below); the mutation only
  // saves it. Queue mutations run one at a time, so a mutation's own
  // onMutate can run well after a click, and a second quick reorder would
  // be worked out from the order before the first.
  const pendingReorders = useRef(0);
  const reorderMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: ({ gameIds }: { gameIds: number[]; previous: QueueItem[] | undefined }) =>
      reorderQueue(gameIds),
    onError: (err, { previous }) => {
      console.error(err);
      // Back to the order just before this one.
      if (previous) queryClient.setQueryData(queueKey, previous);
      toast.error('Failed to reorder queue');
    },
    onSettled: () => {
      // Only once the last pending reorder is saved: a refetch between two
      // quick ones would bring back the order before the second for a moment.
      pendingReorders.current -= 1;
      if (pendingReorders.current > 0) return;
      return queryClient.invalidateQueries({ queryKey: queueKey });
    },
  });

  /** Shows the queue in this order straight away, then saves it. */
  const reorder = (gameIds: number[]) => {
    const previous = queryClient.getQueryData<QueueItem[]>(queueKey);
    if (!previous) return;
    const byId = new Map(previous.map((q) => [q.game_id, q]));
    // Unknown id means the cache and the drag state diverged; let the
    // refetch catch up instead.
    if (!gameIds.every((id) => byId.has(id))) return;
    // A refetch still running from an earlier reorder would land on top of
    // this one with the order from before it.
    void queryClient.cancelQueries({ queryKey: queueKey });
    queryClient.setQueryData<QueueItem[]>(
      queueKey,
      gameIds.map((id, i) => ({ ...byId.get(id)!, position: i })),
    );
    pendingReorders.current += 1;
    reorderMutation.mutate({ gameIds, previous });
  };

  const isStatusLoading =
    pickMutation.isPending ||
    switchGame.isPending ||
    completeMutation.isPending ||
    moveToQueueMutation.isPending ||
    moveToBacklogMutation.isPending ||
    queuedStatusMutation.isPending;

  return {
    currentlyPlaying,
    queue,
    queuedGameIds,
    isLoading: !!userId && (playingPending || queueLoading),
    // Either first load failed: show that, not an empty queue or band.
    loadError: playingError || queueError,
    retry: () => {
      if (playingError) void refetchPlaying();
      if (queueError) retryQueue();
    },
    isStatusLoading,

    statusModal,
    gameSummary,
    openFinish: () => currentlyPlaying && setStatusModal({ action: 'finished' }),
    openDrop: () => currentlyPlaying && setStatusModal({ action: 'dropped' }),
    closeStatusModal: () => setStatusModal(null),
    closeSummary: () => setGameSummary(null),
    confirmStatusChange: (
      status: GameStatus,
      date: string,
      notes: string,
      rating: number | null,
    ) => {
      // The cached game, not the one this render saw: the dialog may have just
      // saved new hours, which the completion summary should show.
      const game = queryClient.getQueryData<GameWithImage | null>(playingKey) ?? currentlyPlaying;
      // The Finish and Drop dialogs only offer these two.
      if (!game || (status !== 'finished' && status !== 'dropped')) return;
      setStatusModal(null);
      // Finishing goes straight to the summary, from what's already known: one
      // more finished game, and the first queued game that's out starts next. The
      // server's answer fills in the exact figures when it arrives.
      if (status === 'finished') {
        const meta = queryClient.getQueryData<LibraryMeta>(queryKeys.library.meta(userId ?? ''));
        const next = nextPlayable(queue);
        setGameSummary(
          buildCompletionSummary({
            finishedGame: game,
            promoted: next ? toPlayingGame(next) : null,
            counts: meta
              ? { gamesFinished: meta.finishedCount + 1, totalGames: meta.gameCount }
              : { gamesFinished: 0, totalGames: 0 },
            rating,
            finishedAt: date,
          }),
        );
        celebrateGameFinished();
      }
      completeMutation.mutate({ game, status, date, notes, rating });
    },

    pick: (game: GameWithImage) => pickMutation.mutateAsync(game).catch(() => undefined),
    /** Starts a queued game; with another one playing, switches to it (with Undo). */
    pickFromQueue: (gameId: number) => {
      const item = queue.find((q) => q.game_id === gameId);
      if (!item) return;
      if (currentlyPlaying) void switchGame.switchTo(fromQueueItem(item));
      else pickMutation.mutate(toPlayingGame(item));
    },
    moveToQueue: () => currentlyPlaying && moveToQueueMutation.mutate(currentlyPlaying),
    moveToBacklog: () => currentlyPlaying && moveToBacklogMutation.mutate(currentlyPlaying),
    addToQueue: addGameToQueue,
    /** Plays a game instead of the one being played (paused at the top of the queue). */
    switchTo: switchGame.switchTo,
    removeFromQueue: removeGameFromQueue,
    /** A queued game's status from its detail dialog; playing starts it like Play does. */
    setQueuedStatus: (vars: StatusEdit) => {
      const item = queue.find((q) => q.game_id === vars.gameId);
      if (vars.status === 'playing') {
        if (item) pickMutation.mutate(toPlayingGame(item));
      } else if (vars.status !== 'backlog') {
        queuedStatusMutation.mutate(vars);
      }
    },
    reorder,
    /**
     * Moves a queued game to the front of the queue, with Undo. Works from the
     * cached queue as it is now, so quick moves in a row each build on the
     * last. False when there's nothing to move (already first, or gone).
     */
    moveToTop: (gameId: number): boolean => {
      const current = queryClient.getQueryData<QueueItem[]>(queueKey) ?? [];
      const ids = current.map((q) => q.game_id);
      const from = ids.indexOf(gameId);
      if (from <= 0) return false;
      const name = current[from].game.name;
      reorder([gameId, ...ids.filter((id) => id !== gameId)]);
      toast(`Moved ${name} to the top`, {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          // Back to where it was, in the queue as it is by then: other games
          // moved, added or removed since stay as they are.
          onClick: () => {
            const now = (queryClient.getQueryData<QueueItem[]>(queueKey) ?? []).map(
              (q) => q.game_id,
            );
            if (!now.includes(gameId)) return;
            const rest = now.filter((id) => id !== gameId);
            rest.splice(Math.min(from, rest.length), 0, gameId);
            if (rest.some((id, i) => id !== now[i])) reorder(rest);
          },
        },
      });
      return true;
    },
  };
}
