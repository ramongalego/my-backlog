'use client';

import { useRouter } from 'next/navigation';
import { ListOrdered, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
import { useState } from 'react';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import { useQueuePage } from '@/hooks/useQueuePage';
import { useLibraryMeta } from '@/hooks/useLibraryMeta';
import { useAuth } from '@/hooks/useAuth';
import { useAddGame } from '@/components/games/AddGameProvider';
import { todayIso } from '@/lib/diary/date-utils';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { QueueContentSkeleton } from './Skeleton';
import { steamLastPlayed } from '@/lib/games/consoles';
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
    handleFinish,
    handleDrop,
    handleMoveToQueue,
    handleMoveToBacklog,
    handleConfirm,
    handleCloseStatusModal,
    handleCloseSummary,
    handleRemoveFromQueue,
    handlePickFromQueue,
    handleReorder,
    handleMoveToTop,
    handleSetQueuedStatus,
    manualDialogProps,
  } = useQueuePage();
  const router = useRouter();
  const { open: openAddGame } = useAddGame();
  const libraryMeta = useLibraryMeta(useAuth().user?.id ?? null);
  const libraryEmpty = libraryMeta.loaded && libraryMeta.gameCount === 0;

  // The queued game whose details are open; read from the queue each render so
  // hours saved in the dialog show straight away.
  const [detailGameId, setDetailGameId] = useState<number | null>(null);
  const detailItem = queue.find((q) => q.game_id === detailGameId);
  const isEmpty = !currentlyPlaying && queue.length === 0;

  return (
    <Page
      overlay={
        <>
          {statusModal && currentlyPlaying && (
            <GameDetailModal
              isOpen={true}
              onClose={handleCloseStatusModal}
              onConfirm={handleConfirm}
              gameName={currentlyPlaying.name}
              headerImage={currentlyPlaying.header_image}
              initialStatus={statusModal.action}
              initialDate={todayIso()}
              // Finishing a console game is a good moment to update its hours.
              playtimeMinutes={currentlyPlaying.playtime_forever}
              manual={manualDialogProps(currentlyPlaying)}
            />
          )}
          {detailItem && (
            <GameDetailModal
              isOpen={true}
              onClose={() => setDetailGameId(null)}
              onConfirm={(status, date, notes, rating) => {
                setDetailGameId(null);
                handleSetQueuedStatus({ gameId: detailItem.game_id, status, date, notes, rating });
              }}
              gameName={detailItem.game.name}
              headerImage={detailItem.game.header_image}
              initialStatus="backlog"
              queued={{ onRemove: () => handleRemoveFromQueue(detailItem.game_id) }}
              mainStoryHours={detailItem.game.main_story_hours}
              steamReviewScore={detailItem.game.steam_review_score}
              steamReviewCount={detailItem.game.steam_review_count}
              criticScore={detailItem.game.critic_score}
              criticCount={detailItem.game.critic_count}
              playtimeMinutes={detailItem.game.playtime_forever}
              lastPlayedAt={steamLastPlayed(detailItem.game)}
              deckCompat={detailItem.game.deck_compat}
              releaseDate={detailItem.game.release_date}
              disablePlaying={!!currentlyPlaying}
              onPlayInstead={() => {
                setDetailGameId(null);
                handlePickFromQueue(detailItem.game_id);
              }}
              playingName={currentlyPlaying?.name ?? null}
              manual={manualDialogProps({ ...detailItem.game, id: detailItem.game_id })}
            />
          )}
          {gameSummary && (
            <GameSummaryModal isOpen={true} onClose={handleCloseSummary} {...gameSummary} />
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
                onFinish={handleFinish}
                onDrop={handleDrop}
                onMoveToQueue={handleMoveToQueue}
                onMoveToBacklog={handleMoveToBacklog}
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
              onPick={handlePickFromQueue}
              onRemove={handleRemoveFromQueue}
              onOpen={setDetailGameId}
              onReorder={handleReorder}
              onMoveToTop={handleMoveToTop}
            />
          )}
        </div>
      )}
    </Page>
  );
}
