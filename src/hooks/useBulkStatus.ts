'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { restoreGameStatuses, updateGameStatuses } from '@/lib/client/game-status';
import { bulkChanges, type BulkGame, type GameRestore } from '@/lib/games/bulk-status';
import type { BulkStatus } from '@/lib/games/status';
import { STATUS_STYLE } from '@/lib/games/status-style';
import type { StatusChange } from '@/lib/games/status-rules';
import { UNDO_MS } from '@/lib/undo';
import { useInvalidateQueries, usePatchGamesList } from './useGameMutations';

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

  const failed = (err: unknown, previousList: ReturnType<typeof gamesList.patchMany>) => {
    console.error('Failed to move games:', err);
    gamesList.restore(previousList);
    toast.error("Couldn't move those games. Please try again.");
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
      toast(said, {
        duration: UNDO_MS,
        action: { label: 'Undo', onClick: () => undo.mutate(previous) },
      });
    },
    onSettled: () => statusChanged(),
  });

  return {
    /**
     * Moves the games to the status; ones already there are left alone.
     * `onMoved` runs once the move is saved (as its toast appears), or straight
     * away when there was nothing to move. Not when the save fails.
     */
    move: (games: BulkGame[], status: BulkStatus, onMoved?: () => void) => {
      const changes = bulkChanges(games, status);
      if (changes.length === 0) {
        onMoved?.();
        return;
      }
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
