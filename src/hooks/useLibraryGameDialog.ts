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
 * Saving goes through the same status change as the Games page, which
 * refreshes every page the change touches.
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
    openGame: (gameId: number) => {
      const game = games.find((g) => g.id === gameId);
      if (game) setOpened(game);
    },
  };
}
