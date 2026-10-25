'use client';

import Image from 'next/image';
import { Archive, Gamepad2, ListOrdered, X, Play, Check, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

import { GameMetaRow } from '@/components/games/GameCardInfo';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import { usePlayingQueuePage } from '@/hooks/usePlayingQueuePage';
import { todayIso } from '@/lib/diary/date-utils';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { QueueListSkeleton } from './Skeleton';
import type { GameWithImage, QueueItem } from '@/types/games';

function GameThumbnail({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    return (
      <div className="relative w-16 h-[30px] sm:w-28 sm:h-[52px] rounded-md overflow-hidden shrink-0 bg-ink-800">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 64px, 112px"
          quality={90}
        />
      </div>
    );
  }
  return (
    <div className="w-16 h-[30px] sm:w-28 sm:h-[52px] bg-ink-800 rounded-md flex items-center justify-center shrink-0">
      <Gamepad2 className="w-4 h-4 text-ink-500" />
    </div>
  );
}

interface NowPlayingRowProps {
  game: GameWithImage;
  onFinish: () => void;
  onDrop: () => void;
  onMoveToQueue: () => void;
  onMoveToBacklog: () => void;
  isLoading?: boolean;
}

function NowPlayingRow({
  game,
  onFinish,
  onDrop,
  onMoveToQueue,
  onMoveToBacklog,
  isLoading,
}: NowPlayingRowProps) {
  const mainStoryHours = game.main_story_hours ?? 0;
  const hasEstimate = mainStoryHours > 0;
  const hasPlaytime = game.playtime_forever >= 60;
  const playedHours = hasPlaytime ? Math.round(game.playtime_forever / 60) : null;
  const estimateHours = hasEstimate ? mainStoryHours : null;
  const isPastEstimate = hasEstimate && hasPlaytime && game.playtime_forever / 60 >= mainStoryHours;
  const progressPct =
    !isPastEstimate && playedHours && estimateHours
      ? Math.min((playedHours / estimateHours) * 100, 100)
      : null;

  const secondaryAction =
    'cursor-pointer flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 disabled:opacity-50 transition-colors';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-ink-900 rounded-xl p-4">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <GameThumbnail src={game.header_image} alt={game.name} />

        <div className="flex-1 min-w-0">
          <p className="font-medium text-ink-50 sm:truncate">{game.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs font-medium text-accent-400">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500" aria-hidden="true" />
            Playing now
          </p>
          <div className="mt-2">
            {isPastEstimate ? (
              <p className="text-xs tabular-nums">
                <span className="text-ink-200">{playedHours}h played</span>
                <span className="text-ink-400"> · past the ~{estimateHours}h estimate</span>
              </p>
            ) : progressPct !== null ? (
              <div className="max-w-56">
                <p className="text-xs text-ink-400 tabular-nums">
                  {playedHours}h played · ~{estimateHours}h to beat
                </p>
                <div className="h-1 bg-ink-800 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-accent-500 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <GameMetaRow
                mainStoryHours={estimateHours}
                steamReviewScore={game.steam_review_score}
                playtimeMinutes={game.playtime_forever}
                deckCompat={game.deck_compat}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 shrink-0">
        <div className="flex gap-2">
          <Button size="sm" onClick={onFinish} disabled={isLoading} className="cursor-pointer">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Finish</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onDrop}
            disabled={isLoading}
            className="cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Drop</span>
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onMoveToQueue} disabled={isLoading} className={secondaryAction}>
            <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Move to Queue</span>
          </button>
          <button onClick={onMoveToBacklog} disabled={isLoading} className={secondaryAction}>
            <Archive className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Move to Backlog</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface QueueItemRowProps {
  item: QueueItem;
  index: number;
  canPlay: boolean;
  isLoading: boolean;
  onPick: (appId: number) => void;
  onRemove: (appId: number) => void;
  isOverlay?: boolean;
}

function QueueItemRow({
  item,
  index,
  canPlay,
  isLoading,
  onPick,
  onRemove,
  isOverlay,
}: QueueItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 sm:gap-4 rounded-lg px-2 py-3 sm:px-3 transition-[opacity,background-color] ${
        isDragging ? 'opacity-0' : 'opacity-100'
      } ${isOverlay ? 'bg-ink-800 shadow-xl shadow-black/40' : 'hover:bg-ink-900'}`}
    >
      <span className="w-5 text-right text-sm font-medium text-ink-500 tabular-nums shrink-0">
        {index + 1}
      </span>

      <GameThumbnail src={item.game.header_image} alt={item.game.name} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-100 truncate mb-1">{item.game.name}</p>
        <GameMetaRow
          mainStoryHours={item.game.main_story_hours}
          steamReviewScore={item.game.steam_review_score}
          playtimeMinutes={item.game.playtime_forever}
          deckCompat={item.game.deck_compat}
          hidePlaytimeOnMobile
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {canPlay && (
          <Button
            size="sm"
            onClick={() => onPick(item.app_id)}
            disabled={isLoading}
            aria-label={`Play ${item.game.name}`}
            className="cursor-pointer px-2.5 sm:px-3"
          >
            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span className="hidden sm:inline">Play</span>
          </Button>
        )}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 text-ink-500 hover:text-ink-200 transition-colors rounded"
          aria-label={`Reorder ${item.game.name}`}
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => onRemove(item.app_id)}
          disabled={isLoading}
          title="Remove from queue"
          aria-label={`Remove ${item.game.name} from queue`}
          className="cursor-pointer p-1.5 text-ink-500 hover:text-ink-200 disabled:opacity-50 transition-colors rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function PlayingQueueView() {
  const {
    currentlyPlaying,
    queue,
    isLoading,
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
  } = usePlayingQueuePage();

  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queue.findIndex((q) => q.id === active.id);
    const newIndex = queue.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(queue, oldIndex, newIndex);
    handleReorder(reordered.map((q) => q.app_id));
  }

  const activeItem = activeId !== null ? queue.find((q) => q.id === activeId) : null;
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
            />
          )}
          {gameSummary && (
            <GameSummaryModal isOpen={true} onClose={handleCloseSummary} {...gameSummary} />
          )}
        </>
      }
    >
      <PageHeader
        title="Playing Queue"
        description="What you're playing now and what's up next. Drag to reorder."
      />

      {isLoading ? (
        <QueueListSkeleton />
      ) : isEmpty ? (
        <div className="py-16 flex flex-col items-center text-center">
          <ListOrdered className="w-8 h-8 text-ink-600 mb-4" aria-hidden="true" />
          <p className="text-ink-200 font-medium">Your queue is empty.</p>
          <p className="text-ink-400 text-sm mt-1 max-w-sm">
            Pick a game to play first, then queue up what&apos;s next from your library.
          </p>
        </div>
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
                isLoading={isStatusLoading}
              />
            </>
          )}

          {currentlyPlaying && queue.length > 0 && (
            <SectionLabel className="mt-10 mb-2">Up Next</SectionLabel>
          )}

          {queue.length > 0 && (
            <DndContext
              id="queue-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-ink-800/70">
                  {queue.map((item, index) => (
                    <QueueItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      canPlay={!currentlyPlaying}
                      isLoading={isStatusLoading}
                      onPick={handlePickFromQueue}
                      onRemove={handleRemoveFromQueue}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeItem && (
                  <QueueItemRow
                    item={activeItem}
                    index={queue.findIndex((q) => q.id === activeId)}
                    canPlay={!currentlyPlaying}
                    isLoading={isStatusLoading}
                    onPick={handlePickFromQueue}
                    onRemove={handleRemoveFromQueue}
                    isOverlay
                  />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}
    </Page>
  );
}
