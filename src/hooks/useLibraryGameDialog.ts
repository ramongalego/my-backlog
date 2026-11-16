'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import type { GameItem } from '@/lib/data/loaders';
import { useSetGameStatus } from '@/hooks/useGameMutations';
import { useGameDialog } from '@/hooks/useGameDialog';
import type { GameDialogProps } from '@/components/games/GameDetailModal';
import type { GameStatus } from '@/lib/games/status';

/**
 * A library game's detail dialog, for any page that lists games: open one by
 * its id and get the dialog's props, filled in from the game as it is (its
 * status, a finished or dropped game's date, notes and rating). Saving goes
 * through the same status change as the Games page, which refreshes every
 * page the change touches.
 *
 *   const { gameDialog, openGame } = useLibraryGameDialog(userId);
 *   <Page overlay={gameDialog && <GameDetailModal isOpen {...gameDialog} />}>
 */
export function useLibraryGameDialog(userId: string | null) {
  const { data: games = [] } = useQuery(queries.gamesList(userId));
  // The game as it was when its dialog opened: the list changing under it
  // (a refetch, another tab) doesn't change what's being edited.
  const [opened, setOpened] = useState<GameItem | null>(null);
  const statusMutation = useSetGameStatus(userId);
  const dialogFor = useGameDialog(userId);

  // When it was finished or dropped, for the dialog's date field.
  const openedDate =
    (opened?.status === 'finished'
      ? opened.finished_at?.slice(0, 10)
      : opened?.status === 'dropped'
        ? opened.dropped_at?.slice(0, 10)
        : null) ?? null;

  const gameDialog: GameDialogProps | null = opened && {
    game: opened,
    initialStatus: opened.status,
    initialDate: openedDate,
    initialNotes: opened.notes,
    initialRating: opened.rating,
    onClose: () => setOpened(null),
    onConfirm: (status: GameStatus, date: string, notes: string, rating: number | null) =>
      statusMutation.mutate({ gameId: opened.id, status, date, notes, rating }),
    // Playing it instead of another game: Undo puts it back as it was
    // (queued, backlog, finished with its date and review...).
    ...dialogFor(opened, {
      status: opened.status,
      from: {
        status: opened.status,
        date: openedDate ?? '',
        notes: opened.notes,
        rating: opened.rating,
      },
    }),
  };

  return {
    gameDialog,
    /** Opens the dialog for a game in the library, by its id. */
    openGame: (gameId: number) => {
      const game = games.find((g) => g.id === gameId);
      if (game) setOpened(game);
    },
  };
}
