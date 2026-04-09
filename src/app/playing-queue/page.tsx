'use client';

import Image from 'next/image';
import { Gamepad2, ListOrdered, X, Play, Check, GripVertical } from 'lucide-react';
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
import type { GameWithImage, QueueItem } from '@/types/games';

function GameThumbnail({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    return (
      <div className="relative w-24 h-[60px] rounded overflow-hidden shrink-0">
        <Image src={src} alt={alt} fill className="object-cover" sizes="96px" />
      </div>
    );
  }
  return (
    <div className="w-24 h-[60px] bg-zinc-800 rounded flex items-center justify-center shrink-0">
      <Gamepad2 className="w-4 h-4 text-zinc-600" />
    </div>
  );
}

interface NowPlayingRowProps {
  game: GameWithImage;
  onFinish: () => void;
  onDrop: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function NowPlayingRow({ game, onFinish, onDrop, onCancel, isLoading }: NowPlayingRowProps) {
  const playedHours = game.playtime_forever >= 60 ? Math.round(game.playtime_forever / 60) : null;
  const estimateHours = game.main_story_hours > 0 ? game.main_story_hours : null;
  const progressPct =
    playedHours && estimateHours ? Math.min((playedHours / estimateHours) * 100, 100) : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-zinc-900 rounded-xl border border-zinc-700 p-4">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
          <Play className="w-3.5 h-3.5 fill-sky-400" />
        </span>

        <GameThumbnail src={game.header_image} alt={game.name} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 sm:truncate mb-1">{game.name}</p>
          {progressPct !== null ? (
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

      <div className="flex items-center justify-center sm:justify-start gap-2 shrink-0">
        <button
          onClick={onFinish}
          disabled={isLoading}
          className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Finish
        </button>
        <button
          onClick={onDrop}
          disabled={isLoading}
          className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 text-xs font-medium rounded-lg transition-colors"
        >
          Drop
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="cursor-pointer flex items-center gap-1.5 px-2 py-1.5 disabled:opacity-50 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Move to Queue
        </button>
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
      className={`flex items-center gap-4 bg-zinc-900 rounded-xl border border-zinc-800 p-4 transition-opacity ${
        isDragging ? 'opacity-0' : 'opacity-100'
      } ${isOverlay ? 'shadow-2xl scale-[1.02] border-zinc-600' : ''}`}
    >
      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 text-sm font-semibold shrink-0">
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

      <div className="flex items-center gap-2 shrink-0">
        {canPlay && (
          <button
            onClick={() => onPick(item.app_id)}
            disabled={isLoading}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Play
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors rounded"
          tabIndex={-1}
        >
          <GripVertical className="w-4 h-4" />
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

function QueueLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-4 h-6 bg-zinc-800 rounded" />
            <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
            <div className="w-24 h-14 bg-zinc-800 rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
              <div className="h-3 bg-zinc-800 rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlayingQueuePage() {
  const {
    currentlyPlaying,
    queue,
    isLoading,
    isStatusLoading,
    statusModal,
    gameSummary,
    handleFinish,
    handleDrop,
    handleCancel,
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
    <div className="min-h-screen bg-zinc-950">
      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-100">Playing Queue</h1>
            <p className="text-zinc-500 text-sm mt-1">Your upcoming games</p>
          </div>

          {isLoading ? (
            <QueueLoadingSkeleton />
          ) : isEmpty ? (
            <div className="text-center py-16">
              <ListOrdered className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">Your queue is empty.</p>
              <p className="text-zinc-600 text-sm mt-1">
                Pick a game to play first, then queue up what&apos;s next from your library.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentlyPlaying && (
                <>
                  <p className="text-xs text-zinc-600 uppercase tracking-wider pb-1">Now Playing</p>
                  <NowPlayingRow
                    game={currentlyPlaying}
                    onFinish={handleFinish}
                    onDrop={handleDrop}
                    onCancel={handleCancel}
                    isLoading={isStatusLoading}
                  />
                </>
              )}

              {currentlyPlaying && queue.length > 0 && (
                <p className="text-xs text-zinc-600 uppercase tracking-wider pt-4 pb-1">Up Next</p>
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
        </div>
      </main>

      {statusModal && currentlyPlaying && (
        <GameDetailModal
          isOpen={true}
          onClose={handleCloseStatusModal}
          onConfirm={handleConfirm}
          gameName={currentlyPlaying.name}
          headerImage={currentlyPlaying.header_image}
          initialStatus={statusModal.action}
          initialDate={new Date().toISOString().slice(0, 10)}
        />
      )}

      {gameSummary && (
        <GameSummaryModal isOpen={true} onClose={handleCloseSummary} {...gameSummary} />
      )}
    </div>
  );
}
