'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queries } from '@/lib/data/queries';
import { reorderQueue } from '@/lib/client/queue';
import {
  QUEUE_SCOPE,
  QUEUE_UNDO_TOAST,
  fromQueueItem,
  toPlayingGame,
  toQueueItem,
  type QueueableGame,
} from '@/lib/games/queue-items';
import { statusChangeFrom, type StatusChange } from '@/lib/games/status-rules';
import { updateGameStatus } from '@/lib/client/game-status';
import type { GameStatus } from '@/lib/games/status';
import { useInvalidateQueries, usePatchGamesList } from '@/hooks/useGameMutations';
import { useInFlight } from '@/hooks/useInFlight';
import { queryKeys } from '@/lib/query-keys';
import { sinceNow, UNDO_MS } from '@/lib/undo';
import type { GameWithImage, QueueItem } from '@/types/games';
import { removeGameFromPools, type CarouselPools } from './useCarouselPools';

/** For Undo to put a switched-to game back. Whether it was queued comes from the cached queue. */
export interface SwitchedFrom {
  status: GameStatus;
  /** Finished or dropped on ("YYYY-MM-DD", or "" for no date). */
  date?: string;
  notes?: string | null;
  rating?: number | null;
}

interface SwitchInput {
  game: QueueableGame;
  /** Paused at the top of the queue. */
  playing: GameWithImage;
  from: SwitchedFrom;
  /** Undoing a switch: `game` is the paused game going back to playing, and
   * `playing` the one switched to, going back to where it was. */
  undo?: {
    /** The switched-to game was queued: the queue's order to go back to. */
    order: number[] | null;
    /** Its start date before the switch (set only if it was paused itself). */
    startedAt: string | null;
    /** The paused game's last-played date before pausing stamped it; undefined when unknown. */
    lastPlayedAt?: string | null;
    /** The switched-to game's start date before the switch stamped it, for a
     * return to finished or dropped. */
    wasStartedAt: string | null;
    /** Milliseconds since the switch, for the history (`sinceNow`). */
    agoMs: number;
  };
}

/**
 * Plays a game while another is playing, pausing that one at the top of the
 * queue in one request, with an Undo that puts both back as they were. Used by
 * the Queue page's Play and every game dialog's Playing.
 */
export function useSwitchGame(userId: string | null) {
  const queryClient = useQueryClient();
  const { statusChanged } = useInvalidateQueries();
  const gamesList = usePatchGamesList(userId);
  const { data: playingNow = null } = useQuery(queries.playing(userId));
  const playingKey = queryKeys.games.playing(userId ?? '');
  const queueKey = queryKeys.queue.list(userId ?? '');
  const inFlight = useInFlight();

  const mutation = useMutation({
    scope: QUEUE_SCOPE,
    mutationFn: async ({ game, playing, from, undo }: SwitchInput) => {
      // The server says which game it paused: the page's idea of what's
      // playing can be out of date (switched on another device meanwhile).
      const switched = await updateGameStatus(
        game.id,
        'playing',
        // On Undo, the switched-to game is paused back into the queue only if
        // it came from there; otherwise it goes to the backlog in the same save.
        undo
          ? {
              pausePlaying: !!undo.order,
              undo: true,
              undoAgoMs: undo.agoMs,
              ...(undo.lastPlayedAt !== undefined ? { lastPlayedAt: undo.lastPlayedAt } : {}),
            }
          : { pausePlaying: true },
      );
      if (!undo) return switched;
      const undoing = { undo: true, undoAgoMs: undo.agoMs };
      if (undo.order) {
        // It wasn't really started, unless it had been paused itself.
        if (!undo.startedAt) await updateGameStatus(playing.id, 'backlog', undoing);
        await reorderQueue(undo.order);
      } else if (from.status !== 'backlog') {
        await updateGameStatus(playing.id, from.status, {
          ...restoreOptions(from),
          ...undoing,
          startedAt: undo.wasStartedAt,
        });
      }
      return switched;
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
    onSuccess: (switched, { game, playing, from, undo }, context) => {
      if (undo) return;
      // Nothing was playing after all (stopped elsewhere): nothing to undo to.
      const stopped = switched.paused[0];
      if (!stopped) {
        toast(`Now playing ${game.name}`);
        return;
      }
      const before = context?.previousQueue ?? [];
      const queuedBefore = before.find((q) => q.game_id === game.id);
      // One Undo per switch, however many times it's clicked.
      let undone = false;
      const since = sinceNow();
      toast(`Now playing ${game.name}. ${stopped.name} is first in your queue.`, {
        id: QUEUE_UNDO_TOAST,
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            // Only while nothing has changed the playing game since.
            const now = queryClient.getQueryData<GameWithImage | null>(playingKey);
            const queue = queryClient.getQueryData<QueueItem[]>(queueKey) ?? [];
            if (undone || now?.id !== game.id) return;
            undone = true;
            // If the queue hasn't caught up, enough of the game to show it
            // playing until the server's answer replaces it.
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
              undo: {
                order,
                startedAt: queuedBefore?.game.started_at ?? null,
                // Only the page's own row from before the switch knows it.
                lastPlayedAt: playing.id === stopped.id ? playing.last_played_at : undefined,
                wasStartedAt: switched.startedAt ?? null,
                agoMs: since(),
              },
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
    /** `from`: where `game` is now, for Undo (whether it's queued is looked up). */
    switchTo: async (game: QueueableGame, from: SwitchedFrom = { status: 'backlog' }) => {
      // A second click before the page shows the switch would send it again.
      const key = `switch:${game.id}`;
      if (!userId || !inFlight.take(key)) return;
      const done = () => inFlight.release(key);
      try {
        // Some pages haven't loaded these. What's cached is used as is so the
        // switch shows at once; the server pauses whatever is really playing.
        const [playing] = await Promise.all([
          queryClient.ensureQueryData(queries.playing(userId)),
          queryClient.ensureQueryData(queries.queue(userId)),
        ]);
        if (!playing || playing.id === game.id) return done();
        // Not waited for: the switch already shows, and the save reports itself.
        void mutation.mutateAsync({ game, playing, from }).then(done, done);
      } catch (err) {
        done();
        throw err;
      }
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
