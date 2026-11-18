'use client';

import { useState } from 'react';
import { useAuth } from './useAuth';
import { useNowPlaying } from './useNowPlaying';
import { useManualGameActions } from './useManualGameActions';
import { useGameDialog } from './useGameDialog';
import { fromQueueItem } from '@/lib/games/queue-items';
import type { GameStatus } from '@/lib/games/status';
import type { GameDialogProps } from '@/components/games/GameDetailModal';

/** useNowPlaying's names kept as they are, so a search for one finds every use. */
export function useQueuePage() {
  const { user, authResolved } = useAuth();
  const userId = user?.id ?? null;
  const nowPlaying = useNowPlaying(userId);
  const manualGames = useManualGameActions(userId);
  const dialogFor = useGameDialog(userId);

  // Read from the queue each render so hours saved in the dialog show at once.
  const [openedId, setOpenedId] = useState<number | null>(null);
  const openedItem = nowPlaying.queue.find((q) => q.game_id === openedId);
  const opened = openedItem && fromQueueItem(openedItem);
  const gameDialog: GameDialogProps | null = opened
    ? {
        game: opened,
        initialStatus: 'backlog',
        onClose: () => setOpenedId(null),
        onConfirm: (status: GameStatus, date: string, notes: string, rating: number | null) => {
          setOpenedId(null);
          nowPlaying.setQueuedStatus({ gameId: opened.id, status, date, notes, rating });
        },
        ...dialogFor(opened, {
          // The same switch as the row's Play button, which the page's
          // buttons wait on.
          onPlayInstead: () => {
            setOpenedId(null);
            nowPlaying.pickFromQueue(opened.id);
          },
        }),
      }
    : null;

  return {
    ...nowPlaying,
    isLoading: !authResolved || nowPlaying.isLoading,
    /** The finish and drop dialog's `manual` prop for a game on a console. */
    manualDialogProps: manualGames.dialogProps,
    /** Null when it's closed. */
    gameDialog,
    openGame: setOpenedId,
  };
}
