'use client';

import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BulkMoveError, restoreGameStatuses, updateGameStatuses } from '@/lib/client/game-status';
import { bulkChanges, type BulkGame, type GameRestore } from '@/lib/games/bulk-status';
import type { BulkStatus } from '@/lib/games/status';
import { STATUS_STYLE } from '@/lib/games/status-style';
import type { StatusChange } from '@/lib/games/status-rules';
import { sinceNow, UNDO_MS } from '@/lib/undo';
import { useInvalidateQueries, usePatchGamesList } from './useGameMutations';

const MOVED_TOAST = 'bulk-move';

function whatWentWrong(err: unknown): string {
  if (err instanceof BulkMoveError) {
    if (err.status === 429) return 'Too many moves in a row. Try again in a moment.';
    // A move the server won't make (the game being played), in its own words.
    if (err.status === 409 && err.message) return err.message;
  }
  return "Couldn't move those games. Please try again.";
}

/**
 * Saved in one request, all or none. Undo sends back what the server said each
 * game had before, so nothing the move cleared (a date, rating, notes) is lost.
 */
export function useBulkStatus(userId: string | null) {
  const gamesList = usePatchGamesList(userId);
  const { statusChanged } = useInvalidateQueries();

  // The button is disabled only from the next render: this stops a second
  // click that lands before it.
  const moving = useRef(false);

  const failed = (err: unknown, previousList: ReturnType<typeof gamesList.patchMany>) => {
    console.error('Failed to move games:', err);
    gamesList.restore(previousList);
    toast.error(whatWentWrong(err));
  };

  const undo = useMutation({
    mutationFn: ({ games, agoMs }: { games: GameRestore[]; agoMs: number }) =>
      restoreGameStatuses(games, agoMs),
    onMutate: ({ games }) => ({ previousList: gamesList.patchRows(games) }),
    onError: (err, _undo, context) => failed(err, context?.previousList),
    onSettled: () => statusChanged(),
  });

  const move = useMutation({
    mutationFn: ({ changes }: { changes: StatusChange[]; said: string }) =>
      updateGameStatuses(changes),
    onMutate: ({ changes }) => ({ previousList: gamesList.patchMany(changes) }),
    onError: (err, _move, context) => failed(err, context?.previousList),
    onSuccess: (previous, { said }) => {
      // One Undo per move, however many times it's clicked.
      let undone = false;
      const since = sinceNow();
      toast(said, {
        // Only the latest move can be undone: undoing an older one after a
        // newer would put games back in between the two.
        id: MOVED_TOAST,
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            if (undone) return;
            undone = true;
            undo.mutate({ games: previous, agoMs: since() });
          },
        },
      });
    },
    onSettled: () => {
      moving.current = false;
      statusChanged();
    },
  });

  return {
    /**
     * `onMoved` runs once the move is saved, or straight away when there was
     * nothing to move; not when the save fails.
     */
    move: (games: BulkGame[], status: BulkStatus, onMoved?: () => void) => {
      if (moving.current) return;
      const changes = bulkChanges(games, status);
      if (changes.length === 0) {
        onMoved?.();
        return;
      }
      moving.current = true;
      move.mutate(
        {
          changes,
          said: `Moved ${changes.length} ${changes.length === 1 ? 'game' : 'games'} to ${STATUS_STYLE[status].label}`,
        },
        { onSuccess: onMoved },
      );
    },
    pending: move.isPending || undo.isPending,
  };
}
