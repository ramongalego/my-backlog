'use client';

import Image from 'next/image';
import { Archive, Gamepad2, ListOrdered, X, Play, Check, GripVertical } from 'lucide-react';
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
      <div className="relative w-16 h-10 sm:w-24 sm:h-[60px] rounded overflow-hidden shrink-0">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 64px, 96px"
          quality={90}
        />
      </div>
    );
  }
  return (
    <div className="w-16 h-10 sm:w-24 sm:h-[60px] bg-zinc-800 rounded flex items-center justify-center shrink-0">
      <Gamepad2 className="w-4 h-4 text-zinc-600" />
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

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-zinc-900 rounded-xl border border-zinc-700 p-3 sm:p-4">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <span className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
          <Play className="w-3.5 h-3.5 fill-sky-400" />
        </span>

        <GameThumbnail src={game.header_image} alt={game.name} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 sm:truncate mb-1">{game.name}</p>
          {isPastEstimate ? (
            <p className="text-xs mt-0.5">
              <span className="text-amber-400">{playedHours}h played</span>
              <span className="text-zinc-500"> · past the ~{estimateHours}h estimate</span>
            </p>
          ) : progressPct !== null ? (
            <div className="w-fit">
              <p className="text-xs text-zinc-500 mt-0.5">
                {playedHours}h played · ~{estimateHours}h to beat
              </p>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-sky-500 rounded-full"
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

      <div className="shrink-0">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <button
            onClick={onFinish}
            disabled={isLoading}
            className="cursor-pointer h-8 flex items-center gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Finish</span>
          </button>
          <button
            onClick={onDrop}
            disabled={isLoading}
            className="cursor-pointer h-8 flex items-center gap-1.5 px-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Drop</span>
          </button>
          <button
            onClick={onMoveToQueue}
            disabled={isLoading}
            className="hidden sm:flex cursor-pointer items-center gap-1.5 px-2 py-1.5 disabled:opacity-50 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Move to Queue</span>
          </button>
          <button
            onClick={onMoveToBacklog}
            disabled={isLoading}
            className="hidden sm:flex cursor-pointer items-center gap-1.5 px-2 py-1.5 disabled:opacity-50 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Move to Backlog</span>
          </button>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2 sm:hidden">
          <button
            onClick={onMoveToQueue}
            disabled={isLoading}
            className="cursor-pointer flex items-center gap-1.5 px-2 py-1.5 disabled:opacity-50 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Move to Queue</span>
          </button>
          <button
            onClick={onMoveToBacklog}
            disabled={isLoading}
            className="cursor-pointer flex items-center gap-1.5 px-2 py-1.5 disabled:opacity-50 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
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
      className={`flex items-center gap-3 sm:gap-4 bg-zinc-900 rounded-xl border border-zinc-800 p-3 sm:p-4 transition-opacity ${
        isDragging ? 'opacity-0' : 'opacity-100'
      } ${isOverlay ? 'shadow-2xl scale-[1.02] border-zinc-600' : ''}`}
    >
      <span className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 text-sm font-semibold shrink-0">
        {index + 1}
      </span>

      <GameThumbnail src={item.game.header_image} alt={item.game.name} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 truncate mb-1">{item.game.name}</p>
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
          <button
            onClick={() => onPick(item.app_id)}
            disabled={isLoading}
            aria-label={`Play ${item.game.name}`}
            className="cursor-pointer flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-white" aria-hidden="true" />
            <span className="hidden sm:inline">Play</span>
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 text-zinc-500 hover:text-zinc-400 transition-colors rounded"
          aria-label={`Reorder ${item.game.name}`}
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => onRemove(item.app_id)}
          disabled={isLoading}
          title="Remove from queue"
          className="cursor-pointer p-1.5 text-zinc-600 hover:text-zinc-400 disabled:opacity-50 transition-colors rounded"
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
      <PageHeader title="Playing Queue" description="Your upcoming games" />

      {isLoading ? (
        <QueueListSkeleton />
      ) : isEmpty ? (
        <div className="text-center py-16">
          <ListOrdered className="w-12 h-12 text-zinc-600 mx-auto mb-4" aria-hidden="true" />
          <p className="text-zinc-500">Your queue is empty.</p>
          <p className="text-zinc-500 text-sm mt-1">
            Pick a game to play first, then queue up what&apos;s next from your library.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentlyPlaying && (
            <>
              <SectionLabel className="pb-1">Now Playing</SectionLabel>
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
            <SectionLabel className="pt-4 pb-1">Up Next</SectionLabel>
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
                <div className="space-y-3">
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
