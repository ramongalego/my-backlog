'use client';

import { useAuth } from './useAuth';
import { useNowPlaying } from './useNowPlaying';
import { useManualGameActions } from './useManualGame';

export function usePlayingQueuePage() {
  const { user, authResolved } = useAuth();
  const nowPlaying = useNowPlaying(user?.id ?? null);
  const manualGames = useManualGameActions(user?.id ?? null);

  const isLoading = !authResolved || nowPlaying.isLoading;

  return {
    currentlyPlaying: nowPlaying.currentlyPlaying,
    queue: nowPlaying.queue,
    isLoading,
    isStatusLoading: nowPlaying.isStatusLoading,
    statusModal: nowPlaying.statusModal,
    gameSummary: nowPlaying.gameSummary,
    handleFinish: nowPlaying.openFinish,
    handleDrop: nowPlaying.openDrop,
    handleMoveToQueue: nowPlaying.moveToQueue,
    handleMoveToBacklog: nowPlaying.moveToBacklog,
    handleConfirm: nowPlaying.confirmStatusChange,
    handleCloseStatusModal: nowPlaying.closeStatusModal,
    handleCloseSummary: nowPlaying.closeSummary,
    handleRemoveFromQueue: nowPlaying.removeFromQueue,
    handlePickFromQueue: nowPlaying.pickFromQueue,
    handleReorder: nowPlaying.reorder,
    handleMoveToTop: nowPlaying.moveToTop,
    /** A queued game's status, set from its detail dialog. */
    handleSetQueuedStatus: nowPlaying.setQueuedStatus,
    /** The finish/drop dialog's `manual` prop for a game on a console. */
    manualDialogProps: manualGames.dialogProps,
  };
}
