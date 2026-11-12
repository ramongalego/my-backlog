'use client';

import { useAuth } from './useAuth';
import { useNowPlaying } from './useNowPlaying';
import { useManualGameActions } from './useManualGameActions';

/**
 * The Queue page is the game being played and its queue: useNowPlaying's state
 * and actions under their own names (so a search for one finds every use),
 * plus what only this page adds.
 */
export function useQueuePage() {
  const { user, authResolved } = useAuth();
  const nowPlaying = useNowPlaying(user?.id ?? null);
  const manualGames = useManualGameActions(user?.id ?? null);

  return {
    ...nowPlaying,
    isLoading: !authResolved || nowPlaying.isLoading,
    /** The detail dialogs' `manual` prop for a game on a console. */
    manualDialogProps: manualGames.dialogProps,
  };
}
