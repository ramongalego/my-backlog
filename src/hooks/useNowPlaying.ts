'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { celebrateGameFinished } from '@/lib/confetti';
import { addToQueue, removeFromQueue, reorderQueue } from '@/lib/games/queue';
import type { LibraryMeta } from '@/lib/data/loaders';
import { queries } from '@/lib/data/queries';
import { completeGame, updateGameStatus } from '@/lib/games/status';
import { buildCompletionSummary } from '@/lib/games/completion';
import { queryKeys } from '@/lib/query-keys';
import { UNDO_MS } from '@/lib/undo';
import { nextPlayable } from '@/lib/games/release-date';
import {
  useInvalidateQueries,
  usePatchGamesList,
  useSetGameStatus,
  type StatusEdit,
} from '@/lib/mutations';
import { statusChangeFrom, type StatusChange } from '@/lib/games/status-rules';
import { removeGameFromPools, type CarouselPools } from './useCarouselPools';
import type { GameWithImage, QueueItem } from '@/types/games';
import type { GameSummaryData } from '@/components/games/GameSummaryModal';

// Every mutation here touches the queue and/or the playing game. Sharing a
// scope makes React Query run them one at a time, so e.g. two quick reorders
// can't reach the server out of order or roll back over each other.
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
      | 'started_at'
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
      started_at: game.started_at ?? null,
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
    // A paused game carries on from when it was first started.
    started_at: item.game.started_at ?? null,
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

type CompletionStatus = 'finished' | 'dropped';

interface SwitchInput {
  /** The queued game to play. */
  item: QueueItem;
  /** The game being played, which is paused at the top of the queue. */
  playing: GameWithImage;
  /** Undoing a switch: the queue's order to go back to, and the start date
   * the game switched to had before (null unless it was paused itself). */
  undo?: { order: number[]; previousStartedAt: string | null };
}

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

  // Playing a queued game while another is playing: the queued game starts and
  // the one being played is paused at the top of the queue (start date kept),
  // in one request. Undo switches back and puts the queue back in its order.
  const switchMutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: async ({ item, playing, undo }: SwitchInput) => {
      await updateGameStatus(item.game_id, 'playing', { pausePlaying: true });
      if (!undo) return;
      // The game switched to a moment ago wasn't really started: clear its
      // start date unless it had one already (paused itself).
      if (!undo.previousStartedAt) await updateGameStatus(playing.id, 'backlog');
      await reorderQueue(undo.order);
    },
    onMutate: async ({ item, playing, undo }) => {
      const context = await snapshot({ gameId: item.game_id, status: 'playing' });
      queryClient.setQueryData(playingKey, toPlayingGame(item));
      queryClient.setQueryData<QueueItem[]>(queueKey, (old = []) => {
        const paused = toQueueItem(
          { ...playing, started_at: undo ? undo.previousStartedAt : playing.started_at },
          0,
        );
        const rest = old.filter((q) => q.game_id !== item.game_id && q.game_id !== playing.id);
        const next = [paused, ...rest];
        const ordered = undo
          ? undo.order.flatMap((id) => next.filter((q) => q.game_id === id))
          : next;
        return ordered.map((q, i) => ({ ...q, position: i }));
      });
      queryClient.setQueriesData<CarouselPools>(
        { queryKey: queryKeys.carousels.all },
        (pools) => pools && removeGameFromPools(pools, item.game_id),
      );
      return context;
    },
    onError: (err, _vars, context) => {
      console.error('Failed to switch games:', err);
      rollback(context);
      toast.error("Couldn't switch games. Please try again.");
    },
    onSuccess: (_data, { item, playing, undo }, context) => {
      if (undo) return;
      const order = (context?.previousQueue ?? []).map((q) => q.game_id);
      const previousStartedAt = item.game.started_at ?? null;
      toast(`Now playing ${item.game.name}. ${playing.name} is first in your queue.`, {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            // Only while nothing else has changed the playing game since.
            const now = queryClient.getQueryData<GameWithImage | null>(playingKey);
            const queued = queryClient
              .getQueryData<QueueItem[]>(queueKey)
              ?.find((q) => q.game_id === playing.id);
            if (now?.id !== item.game_id || !queued) return;
            // The queue as it was, with anything added since at the end and
            // anything removed since left out.
            const ids = (queryClient.getQueryData<QueueItem[]>(queueKey) ?? [])
              .map((q) => q.game_id)
              .filter((id) => id !== playing.id);
            const after = [item.game_id, ...ids];
            const restored = [
              ...order.filter((id) => after.includes(id)),
              ...after.filter((id) => !order.includes(id)),
            ];
            switchMutation.mutate({
              item: queued,
              playing: now,
              undo: { order: restored, previousStartedAt },
            });
          },
        },
      });
    },
    onSettled: () => statusChanged(),
  });

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
        duration: UNDO_MS,
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
    switchMutation.isPending ||
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
    confirmStatusChange: (status: string, date: string, notes: string, rating: number | null) => {
      // The cached game, not the one this render saw: the dialog may have just
      // saved new hours, which the completion summary should show.
      const game = queryClient.getQueryData<GameWithImage | null>(playingKey) ?? currentlyPlaying;
      if (!game) return;
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
      if (currentlyPlaying) switchMutation.mutate({ item, playing: currentlyPlaying });
      else pickMutation.mutate(toPlayingGame(item));
    },
    moveToQueue: () => currentlyPlaying && moveToQueueMutation.mutate(currentlyPlaying),
    moveToBacklog: () => currentlyPlaying && moveToBacklogMutation.mutate(currentlyPlaying),
    addToQueue: addGameToQueue,
    removeFromQueue: (gameId: number) => removeMutation.mutate(gameId),
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
