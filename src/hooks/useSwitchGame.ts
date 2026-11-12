'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queries } from '@/lib/data/queries';
import { removeFromQueue, reorderQueue } from '@/lib/client/queue';
import {
  QUEUE_SCOPE,
  fromQueueItem,
  toPlayingGame,
  toQueueItem,
  type QueueableGame,
} from '@/lib/games/queue-items';
import { statusChangeFrom, type StatusChange } from '@/lib/games/status-rules';
import { updateGameStatus } from '@/lib/client/game-status';
import type { GameStatus } from '@/lib/games/status';
import { useInvalidateQueries, usePatchGamesList } from '@/hooks/useGameMutations';
import { queryKeys } from '@/lib/query-keys';
import { UNDO_MS } from '@/lib/undo';
import type { GameWithImage, QueueItem } from '@/types/games';
import { removeGameFromPools, type CarouselPools } from './useCarouselPools';

/**
 * Where a game was before it was switched to, for Undo to put it back: its
 * status, and for a finished or dropped game what goes with it. Whether it
 * was queued (and where) comes from the queue as it was.
 */
export interface SwitchedFrom {
  status: GameStatus;
  /** Finished or dropped on ("YYYY-MM-DD", or "" for no date). */
  date?: string;
  notes?: string | null;
  rating?: number | null;
}

interface SwitchInput {
  /** The game to play. */
  game: QueueableGame;
  /** The game being played, which is paused at the top of the queue. */
  playing: GameWithImage;
  from: SwitchedFrom;
  /** Undoing a switch: `game` is the paused game going back to playing, and
   * `playing` the one switched to, going back to where it was. */
  undo?: {
    /** The switched-to game was queued: the queue's order to go back to. */
    order: number[] | null;
    /** Its start date before the switch (set only if it was paused itself). */
    startedAt: string | null;
  };
}

/**
 * Plays a game while another is playing: the game starts and the one being
 * played is paused at the top of the queue, keeping its start date (one
 * request, `pausePlaying`). Says so in a toast with Undo, which switches back
 * and puts the game switched to back where it was: its place in the queue,
 * the backlog, or its finished or dropped status with date, notes and rating.
 * The queue page's Play and every game dialog's Playing use this.
 */
export function useSwitchGame(userId: string | null) {
  const queryClient = useQueryClient();
  const { statusChanged } = useInvalidateQueries();
  const gamesList = usePatchGamesList(userId);
  const { data: playingNow = null } = useQuery(queries.playing(userId));
  const playingKey = queryKeys.games.playing(userId ?? '');
  const queueKey = queryKeys.queue.list(userId ?? '');

  const mutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: async ({ game, playing, from, undo }: SwitchInput) => {
      // The server says which game it paused: the page's idea of what's
      // playing can be out of date (switched on another device meanwhile).
      const { paused } = await updateGameStatus(game.id, 'playing', { pausePlaying: true });
      if (!undo) return paused;
      // `playing` (switched to a moment ago) is paused at the top of the
      // queue now: put it back where it was.
      if (undo.order) {
        // It wasn't really started, unless it was paused itself.
        if (!undo.startedAt) await updateGameStatus(playing.id, 'backlog');
        await reorderQueue(undo.order);
      } else if (from.status === 'backlog') {
        await removeFromQueue(playing.id);
        await updateGameStatus(playing.id, 'backlog');
      } else {
        // Any status but backlog takes it off the queue too.
        await updateGameStatus(playing.id, from.status, restoreOptions(from));
      }
      return paused;
    },
    onMutate: async ({ game, playing, from, undo }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: playingKey }),
        queryClient.cancelQueries({ queryKey: queueKey }),
      ]);
      const changes: StatusChange[] = [{ gameId: game.id, status: 'playing' }];
      if (undo && !undo.order) {
        changes.push(statusChangeFrom({ gameId: playing.id, ...from, status: from.status }));
      }
      const context = {
        previousPlaying: queryClient.getQueryData<GameWithImage | null>(playingKey),
        previousQueue: queryClient.getQueryData<QueueItem[]>(queueKey),
        previousList: gamesList.patch(...changes),
      };

      queryClient.setQueryData(playingKey, toPlayingGame(toQueueItem(game, 0)));
      queryClient.setQueryData<QueueItem[]>(queueKey, (old) => {
        if (!old) return old;
        const rest = old.filter((q) => q.game_id !== game.id && q.game_id !== playing.id);
        let next: QueueItem[];
        if (!undo) {
          next = [toQueueItem(playing, 0), ...rest];
        } else if (undo.order) {
          const back = toQueueItem({ ...playing, started_at: undo.startedAt }, 0);
          const all = [back, ...rest];
          next = undo.order.flatMap((id) => all.filter((q) => q.game_id === id));
        } else {
          next = rest;
        }
        return next.map((q, i) => ({ ...q, position: i }));
      });
      queryClient.setQueriesData<CarouselPools>(
        { queryKey: queryKeys.carousels.all },
        (pools) => pools && removeGameFromPools(pools, game.id),
      );
      return context;
    },
    onError: (err, _vars, context) => {
      console.error('Failed to switch games:', err);
      if (context) {
        if (context.previousPlaying !== undefined) {
          queryClient.setQueryData(playingKey, context.previousPlaying);
        }
        if (context.previousQueue !== undefined) {
          queryClient.setQueryData(queueKey, context.previousQueue);
        }
        gamesList.restore(context.previousList);
      }
      toast.error("Couldn't switch games. Please try again.");
    },
    onSuccess: (paused, { game, from, undo }, context) => {
      if (undo) return;
      // Nothing was playing after all (stopped elsewhere): nothing to undo to.
      const stopped = paused[0];
      if (!stopped) {
        toast(`Now playing ${game.name}`);
        return;
      }
      const before = context?.previousQueue ?? [];
      const queuedBefore = before.find((q) => q.game_id === game.id);
      toast(`Now playing ${game.name}. ${stopped.name} is first in your queue.`, {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            // Only while nothing has changed the playing game since.
            const now = queryClient.getQueryData<GameWithImage | null>(playingKey);
            const queue = queryClient.getQueryData<QueueItem[]>(queueKey) ?? [];
            if (now?.id !== game.id) return;
            // Its queue row, or (if the queue hasn't caught up yet) enough of
            // it to show it playing until the server's answer replaces it.
            const pausedRow = queue.find((q) => q.game_id === stopped.id);
            const pausedGame = pausedRow
              ? fromQueueItem(pausedRow)
              : {
                  id: stopped.id,
                  name: stopped.name,
                  app_id: null,
                  header_image: null,
                  main_story_hours: null,
                  playtime_forever: 0,
                };
            let order: number[] | null = null;
            if (queuedBefore) {
              // The queue as it was, with anything added since at the end and
              // anything removed since left out.
              const was = before.map((q) => q.game_id);
              const after = [game.id, ...queue.map((q) => q.game_id)].filter(
                (id) => id !== stopped.id,
              );
              order = [
                ...was.filter((id) => after.includes(id)),
                ...after.filter((id) => !was.includes(id)),
              ];
            }
            mutation.mutate({
              game: pausedGame,
              playing: now,
              from,
              undo: { order, startedAt: queuedBefore?.game.started_at ?? null },
            });
          },
        },
      });
    },
    onSettled: () => statusChanged(),
  });

  return {
    /** The game being played, which a switch would pause: for the dialogs' wording. */
    playing: playingNow,
    /**
     * Plays `game` instead of the game being played. `from`: where the game is
     * now, for Undo (backlog by default; whether it's queued is looked up).
     */
    switchTo: async (game: QueueableGame, from: SwitchedFrom = { status: 'backlog' }) => {
      if (!userId) return;
      // Pages that don't show the playing game or the queue may not have them
      // loaded yet; the switch needs both. What's loaded is used as it is, so
      // the switch shows at once (the server pauses whatever is really playing).
      const [playing] = await Promise.all([
        queryClient.ensureQueryData(queries.playing(userId)),
        queryClient.ensureQueryData(queries.queue(userId)),
      ]);
      if (!playing || playing.id === game.id) return;
      mutation.mutate({ game, playing, from });
    },
    isPending: mutation.isPending,
  };
}

function restoreOptions({ status, date, notes, rating }: SwitchedFrom) {
  return {
    finishedAt: status === 'finished' && date ? date : undefined,
    droppedAt: status === 'dropped' && date ? date : undefined,
    notes: notes ?? undefined,
    rating: rating ?? null,
  };
}
