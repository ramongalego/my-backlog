'use client';

import { useRouter } from 'next/navigation';
import { ListOrdered, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import { useQueuePage } from '@/hooks/useQueuePage';
import { useLibraryMeta } from '@/hooks/useLibraryMeta';
import { useAuth } from '@/hooks/useAuth';
import { useAddGame } from '@/components/games/AddGameProvider';
import { todayIso } from '@/lib/diary/date-utils';
import { COMPLETION_STATUSES } from '@/lib/games/status';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { QueueContentSkeleton } from './Skeleton';
import { NowPlayingRow } from '@/components/queue/NowPlayingRow';
import { QueueList } from '@/components/queue/QueueList';

export default function PlayingQueueView() {
  const {
    currentlyPlaying,
    queue,
    isLoading,
    loadError,
    retry,
    isStatusLoading,
    statusModal,
    gameSummary,
    openFinish,
    openDrop,
    moveToQueue,
    moveToBacklog,
    confirmStatusChange,
    closeStatusModal,
    closeSummary,
    removeFromQueue,
    pickFromQueue,
    reorder,
    moveToTop,
    manualDialogProps,
    gameDialog,
    openGame,
  } = useQueuePage();
  const router = useRouter();
  const { open: openAddGame } = useAddGame();
  const libraryMeta = useLibraryMeta(useAuth().user?.id ?? null);
  const libraryEmpty = libraryMeta.loaded && libraryMeta.gameCount === 0;

  const isEmpty = !currentlyPlaying && queue.length === 0;

  return (
    <Page
      overlay={
        <>
          {statusModal && currentlyPlaying && (
            <GameDetailModal
              isOpen={true}
              onClose={closeStatusModal}
              onConfirm={confirmStatusChange}
              // Just the game and its hours: finishing a console game is a
              // good moment to update them.
              game={{
                name: currentlyPlaying.name,
                header_image: currentlyPlaying.header_image,
                playtime_forever: currentlyPlaying.playtime_forever,
              }}
              initialStatus={statusModal.action}
              savedStatus="playing"
              statuses={COMPLETION_STATUSES}
              initialDate={todayIso()}
              manual={manualDialogProps(currentlyPlaying)}
            />
          )}
          {gameDialog && <GameDetailModal isOpen {...gameDialog} />}
          {gameSummary && (
            <GameSummaryModal isOpen={true} onClose={closeSummary} {...gameSummary} />
          )}
        </>
      }
    >
      <PageHeader title="Playing Queue" description="What you're playing now and what's up next" />

      {isLoading ? (
        <QueueContentSkeleton />
      ) : loadError ? (
        <LoadError what="your queue" onRetry={retry} />
      ) : isEmpty ? (
        // An empty library has nothing to pick yet: add a game first.
        <EmptyState
          icon={ListOrdered}
          title="Your queue is empty"
          action={
            libraryEmpty ? (
              <Button className="cursor-pointer" onClick={() => openAddGame()}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add a game</span>
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="cursor-pointer"
                onClick={() => router.push('/home')}
              >
                Go to Home
              </Button>
            )
          }
        >
          {libraryEmpty
            ? 'Add the games you own, then start one and queue up what’s next.'
            : 'Pick a game to play on Home, then queue up what’s next from your library.'}
        </EmptyState>
      ) : (
        <div>
          {currentlyPlaying && (
            <>
              <SectionLabel className="sr-only">Now Playing</SectionLabel>
              <NowPlayingRow
                game={currentlyPlaying}
                onFinish={openFinish}
                onDrop={openDrop}
                onMoveToQueue={moveToQueue}
                onMoveToBacklog={moveToBacklog}
                onSaveHours={manualDialogProps(currentlyPlaying)?.onSaveHours}
                isLoading={isStatusLoading}
              />
            </>
          )}

          {currentlyPlaying && queue.length > 0 && (
            <SectionLabel className="mt-10 mb-2">Up Next</SectionLabel>
          )}

          {queue.length > 0 && (
            <QueueList
              queue={queue}
              playingName={currentlyPlaying?.name ?? null}
              isLoading={isStatusLoading}
              onPick={pickFromQueue}
              onRemove={removeFromQueue}
              onOpen={openGame}
              onReorder={reorder}
              onMoveToTop={moveToTop}
            />
          )}
        </div>
      )}
    </Page>
  );
}
