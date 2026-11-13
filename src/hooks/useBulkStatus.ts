'use client';

import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BulkMoveError, restoreGameStatuses, updateGameStatuses } from '@/lib/client/game-status';
import { bulkChanges, type BulkGame, type GameRestore } from '@/lib/games/bulk-status';
import type { BulkStatus } from '@/lib/games/status';
import { STATUS_STYLE } from '@/lib/games/status-style';
import type { StatusChange } from '@/lib/games/status-rules';
import { UNDO_MS } from '@/lib/undo';
import { useInvalidateQueries, usePatchGamesList } from './useGameMutations';

const MOVED_TOAST = 'bulk-move';

/** What to tell the player when a move or its Undo couldn't be saved. */
function whatWentWrong(err: unknown): string {
  if (err instanceof BulkMoveError) {
    if (err.status === 429) return 'Too many moves in a row. Try again in a moment.';
    // The server's own words for a move it won't make (the game being played).
    if (err.status === 409 && err.message) return err.message;
  }
  return "Couldn't move those games. Please try again.";
}

/**
 * Moves several games to a status at once (Games, Select). The games change on
 * the page straight away and are saved in one request, all or none; a toast
 * says how many moved, with an Undo. The server answers a move with what each
 * game had before, and Undo sends exactly that back, so nothing the move
 * cleared (a date, a rating, notes) is lost.
 */
export function useBulkStatus(userId: string | null) {
  const gamesList = usePatchGamesList(userId);
  const { statusChanged } = useInvalidateQueries();

  // A move in flight. The button is disabled while one is, but only from the
  // next render: this stops a second click that lands before it.
  const moving = useRef(false);

  const failed = (err: unknown, previousList: ReturnType<typeof gamesList.patchMany>) => {
    console.error('Failed to move games:', err);
    gamesList.restore(previousList);
    toast.error(whatWentWrong(err));
  };

  const undo = useMutation({
    mutationFn: (games: GameRestore[]) => restoreGameStatuses(games),
    onMutate: (games) => ({ previousList: gamesList.patchRows(games) }),
    onError: (err, _games, context) => failed(err, context?.previousList),
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
      toast(said, {
        // The same toast each time, so a new move takes the last one's place:
        // only the latest move can be undone. (Undoing an older one after a
        // newer would put games back in between the two.)
        id: MOVED_TOAST,
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            if (undone) return;
            undone = true;
            undo.mutate(previous);
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
     * Moves the games to the status; ones already there are left alone.
     * `onMoved` runs once the move is saved (as its toast appears), or straight
     * away when there was nothing to move. Not when the save fails.
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
