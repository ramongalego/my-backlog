'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { celebrateGameFinished } from '@/lib/confetti';
import { reorderQueue } from '@/lib/client/queue';
import type { LibraryMeta } from '@/lib/data/loaders';
import { queries } from '@/lib/data/queries';
import { completeGame, updateGameStatus } from '@/lib/client/game-status';
import { buildCompletionSummary, type GameSummaryData } from '@/lib/games/completion';
import { queryKeys } from '@/lib/query-keys';
import { sinceNow, UNDO_MS } from '@/lib/undo';
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
import {
  QUEUE_SCOPE,
  QUEUE_UNDO_TOAST,
  fromQueueItem,
  moreQueueChangesWaiting,
  toPlayingGame,
  toQueueItem,
} from '@/lib/games/queue-items';
import { useAddToQueue, useQueue, useRemoveFromQueue } from '@/hooks/useQueue';
import type { CompletionStatus, GameStatus } from '@/lib/games/status';
import { useInFlight } from '@/hooks/useInFlight';

interface CompleteInput {
  game: GameWithImage;
  status: CompletionStatus;
  date: string;
  notes: string;
  rating: number | null;
}

/** The playing game, the queue and every action on them, shared by Home and the Queue page. */
export function useNowPlaying(userId: string | null) {
  const queryClient = useQueryClient();
  const { statusChanged } = useInvalidateQueries();
  const gamesList = usePatchGamesList(userId);
  const playingKey = queryKeys.games.playing(userId ?? '');
  const queueKey = queryKeys.queue.list(userId ?? '');

  const [statusModal, setStatusModal] = useState<{ action: CompletionStatus } | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);
  // The save behind the summary on screen, which opens before it's done.
  const summarySave = useRef<Promise<unknown>>(Promise.resolve());

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
  // Play, Finish and the two Moves go once per game, however many clicks land
  // before the redraw.
  const { once } = useInFlight();
  const addGameToQueue = useAddToQueue(userId);
  const removeGameFromQueue = useRemoveFromQueue(userId);

  // Status changes patch the cached games list (Games, Stats) the way the
  // server applies them, instead of refetching it.
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
    // `undoAgoMs` (ms since the move away) marks an Undo for the history and
    // keeps the old start date, or "Playing since" would jump to today.
    mutationFn: ({ game, undoAgoMs }: { game: GameWithImage; undoAgoMs?: number }) =>
      undoAgoMs !== undefined
        ? updateGameStatus(game.id, 'playing', {
            undo: true,
            undoAgoMs,
            startedAt: game.started_at,
            lastPlayedAt: game.last_played_at ?? null,
          })
        : updateGameStatus(game.id, 'playing'),
    onMutate: async ({ game }) => {
      // An Undo still on screen would start its game over this one.
      toast.dismiss(QUEUE_UNDO_TOAST);
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
    onError: (err, _started, context) => {
      console.error('Failed to pick game:', err);
      rollback(context);
      toast.error('Failed to start playing');
    },
    onSettled: () => statusChanged(),
  });

  /** Starts a game, once: the server takes it off the queue if it was queued. */
  const start = (game: GameWithImage, undoAgoMs?: number) =>
    once(`play:${game.id}`, () => pickMutation.mutateAsync({ game, undoAgoMs }));
  /** The playing game leaving (finished, dropped, queued or to the backlog), once. */
  const stop = (game: GameWithImage, send: () => Promise<unknown>) => once(`stop:${game.id}`, send);

  const completeMutation = useMutation({
    scope: QUEUE_SCOPE,
    // Also starts the next queued game; that part is best effort and reported
    // apart (`promoteFailed`).
    mutationFn: ({ game, status, date, notes, rating }: CompleteInput) =>
      completeGame(game.id, status, { date, notes, rating }),
    onSuccess: ({ counts, promoted, promoteFailed }, { game, status, date, notes, rating }) => {
      if (promoteFailed) toast.error("Couldn't start the next game from your queue");
      gamesList.patch(
        statusChangeFrom({ gameId: game.id, status, date, notes, rating }),
        ...(promoted ? [{ gameId: promoted.id, status: 'playing' as const }] : []),
      );
      queryClient.setQueryData(playingKey, promoted);
      if (promoted) dropFromQueue(promoted.id);
      // The summary opened with an estimate; the server's figures replace it
      // unless it's been closed.
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

  // One click on a quiet link takes the game off Home, so say where it went
  // and offer to bring it back.
  const offerUndo = (game: GameWithImage, where: 'queue' | 'backlog') => {
    const since = sinceNow();
    toast(`Moved ${game.name} to your ${where}`, {
      id: QUEUE_UNDO_TOAST,
      duration: UNDO_MS,
      action: { label: 'Undo', onClick: () => void start(game, since()) },
    });
  };

  const moveToQueueMutation = useMutation({
    scope: QUEUE_SCOPE,
    // To the top of the queue: it's the game most likely to be picked up again.
    mutationFn: (game: GameWithImage) => updateGameStatus(game.id, 'backlog', { queueAtTop: true }),
    onMutate: async (game) => {
      const context = await snapshot({ gameId: game.id, status: 'backlog' });
      queryClient.setQueryData(playingKey, null);
      queryClient.setQueryData<QueueItem[]>(queueKey, (old = []) =>
        [toQueueItem(game, 0), ...old].map((q, i) => ({ ...q, position: i })),
      );
      return context;
    },
    onError: (err, _game, context) => {
      console.error('Failed to move game to queue:', err);
      rollback(context);
      toast.error('Failed to move game to queue');
    },
    onSuccess: (_data, game) => offerUndo(game, 'queue'),
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

  const switchGame = useSwitchGame(userId);

  // The queue only holds backlog games, so any other status takes it off (as
  // on the server).
  const queuedStatusMutation = useSetGameStatus(userId, {
    scope: QUEUE_SCOPE,
    apply: async (vars) => {
      const context = await snapshot();
      if (vars.status !== 'backlog') dropFromQueue(vars.gameId);
      return context;
    },
    rollback,
  });

  // `reorder` shows the order itself: queue mutations run one at a time, so
  // an onMutate can run late and a quick second reorder would see stale order.
  const reorderMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: ({
      gameIds,
    }: {
      gameIds: number[];
      previous: QueueItem[] | undefined;
      offeredUndo: boolean;
    }) => reorderQueue(gameIds),
    onError: (err, { previous, offeredUndo }) => {
      console.error(err);
      if (previous) queryClient.setQueryData(queueKey, previous);
      // The move its toast announced didn't happen.
      if (offeredUndo) toast.dismiss(QUEUE_UNDO_TOAST);
      toast.error('Failed to reorder queue');
    },
    onSettled: () => {
      // A refetch between two quick changes would flash the older order.
      if (moreQueueChangesWaiting(queryClient)) return;
      return queryClient.invalidateQueries({ queryKey: queueKey });
    },
  });

  /** `offeredUndo`: the caller showed an Undo toast, taken down if the save fails. */
  const reorder = (gameIds: number[], offeredUndo = false) => {
    const previous = queryClient.getQueryData<QueueItem[]>(queueKey);
    if (!previous) return;
    const byId = new Map(previous.map((q) => [q.game_id, q]));
    // An unknown id means the cache and the drag state diverged; the refetch
    // catches up.
    if (!gameIds.every((id) => byId.has(id))) return;
    // A refetch still running from an earlier reorder would land on top of
    // this one with the order from before it.
    void queryClient.cancelQueries({ queryKey: queueKey });
    queryClient.setQueryData<QueueItem[]>(
      queueKey,
      gameIds.map((id, i) => ({ ...byId.get(id)!, position: i })),
    );
    reorderMutation.mutate({ gameIds, previous, offeredUndo });
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
    /** Resolves once the summary's game is saved as finished (its Share waits for it). */
    summarySaved: () => summarySave.current,
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
      void stop(game, () => {
        setStatusModal(null);
        // The summary opens at once with an estimate; the server's answer
        // fills in the exact figures.
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
        const saved = completeMutation.mutateAsync({ game, status, date, notes, rating });
        summarySave.current = saved;
        return saved;
      });
    },

    pick: start,
    /** Starts a queued game; with another one playing, switches to it (with Undo). */
    pickFromQueue: (gameId: number) => {
      const item = queue.find((q) => q.game_id === gameId);
      if (!item) return;
      if (currentlyPlaying) void switchGame.switchTo(fromQueueItem(item));
      else void start(toPlayingGame(item));
    },
    moveToQueue: () => {
      const game = currentlyPlaying;
      if (game) void stop(game, () => moveToQueueMutation.mutateAsync(game));
    },
    moveToBacklog: () => {
      const game = currentlyPlaying;
      if (game) void stop(game, () => moveToBacklogMutation.mutateAsync(game));
    },
    addToQueue: addGameToQueue,
    /** Plays a game instead of the one being played (paused at the top of the queue). */
    switchTo: switchGame.switchTo,
    removeFromQueue: removeGameFromQueue,
    /** A queued game's status from its detail dialog; playing starts it like Play does. */
    setQueuedStatus: (vars: StatusEdit) => {
      const item = queue.find((q) => q.game_id === vars.gameId);
      if (vars.status === 'playing') {
        if (item) void start(toPlayingGame(item));
      } else if (vars.status !== 'backlog') {
        queuedStatusMutation.mutate(vars);
      }
    },
    reorder,
    /**
     * Reads the cached queue, so quick moves in a row each build on the last.
     * False when there's nothing to move (already first, or gone).
     */
    moveToTop: (gameId: number): boolean => {
      const current = queryClient.getQueryData<QueueItem[]>(queueKey) ?? [];
      const ids = current.map((q) => q.game_id);
      const from = ids.indexOf(gameId);
      if (from <= 0) return false;
      const name = current[from].game.name;
      reorder([gameId, ...ids.filter((id) => id !== gameId)], true);
      toast(`Moved ${name} to the top`, {
        id: QUEUE_UNDO_TOAST,
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          // Other games moved, added or removed since stay as they are.
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
