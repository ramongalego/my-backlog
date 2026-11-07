'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { QueueItemRow, SortableQueueItem } from '@/components/queue/QueueItemRow';
import type { QueueItem } from '@/types/games';

interface QueueListProps {
  queue: QueueItem[];
  /** The game being played, which Play on a row would switch from; null if none. */
  playingName: string | null;
  isLoading: boolean;
  onPick: (gameId: number) => void;
  onRemove: (gameId: number) => void;
  onOpen: (gameId: number) => void;
  /** The new order, after a drag. */
  onReorder: (gameIds: number[]) => void;
  /** Moves a game to the front; false when there was nothing to move. */
  onMoveToTop: (gameId: number) => boolean;
}

/**
 * The queue's rows, in order, to drag (pointer or keyboard) or move to the
 * top. Reorders show at once; saving them is the caller's (`onReorder`).
 */
export function QueueList({
  queue,
  playingName,
  isLoading,
  onPick,
  onRemove,
  onOpen,
  onReorder,
  onMoveToTop,
}: QueueListProps) {
  // The game being dragged.
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // What a screen reader hears while moving a game from the keyboard: its
  // name and place in the queue, instead of dnd-kit's "Draggable item 156 was
  // moved over droppable area 1640". A game dropped on another's row takes
  // that row's place.
  const nameOf = (id: UniqueIdentifier) =>
    queue.find((q) => q.game_id === id)?.game.name ?? 'The game';
  const placeOf = (id: UniqueIdentifier) =>
    `number ${queue.findIndex((q) => q.game_id === id) + 1} of ${queue.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} moved to ${placeOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      `${nameOf(active.id)} dropped at ${placeOf(over?.id ?? active.id)}.`,
    onDragCancel: ({ active }) =>
      `Move cancelled. ${nameOf(active.id)} stays at ${placeOf(active.id)}.`,
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queue.findIndex((q) => q.game_id === active.id);
    const newIndex = queue.findIndex((q) => q.game_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(queue, oldIndex, newIndex).map((q) => q.game_id));
  }

  // The button goes with the game to the top, where the first game has none,
  // so focus follows the game there instead of dropping to the page: once the
  // list has re-rendered, since until then the game is still where it was.
  // From the keyboard the page scrolls along with it, so the focus stays in
  // sight; with a mouse it stays put, to move the next game up.
  const focusAfterMove = useRef<{ gameId: number; fromKeyboard: boolean } | null>(null);
  useEffect(() => {
    const pending = focusAfterMove.current;
    if (!pending) return;
    // The move is the first queue change after the click; only that one counts.
    focusAfterMove.current = null;
    if (queue[0]?.game_id !== pending.gameId) return;
    document
      .querySelector<HTMLElement>(`[data-queue-handle="${pending.gameId}"]`)
      ?.focus({ preventScroll: !pending.fromKeyboard });
  }, [queue]);

  function moveToTop(gameId: number, fromKeyboard: boolean) {
    if (onMoveToTop(gameId)) focusAfterMove.current = { gameId, fromKeyboard };
  }

  const activeItem = activeId !== null ? queue.find((q) => q.game_id === activeId) : null;
  const rowProps = { playingName, isLoading, onPick, onRemove, onOpen, onMoveToTop: moveToTop };

  return (
    <DndContext
      id="queue-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Rows go by game: a game queued a moment ago has a stand-in queue id
          until the server's arrives, and a changing id would remount its row,
          or lose the row being dragged. */}
      <SortableContext items={queue.map((q) => q.game_id)} strategy={verticalListSortingStrategy}>
        {/* No scroll anchoring: with a row focused, the browser would scroll
            after it when it moves to the top. */}
        <div className="divide-y divide-ink-800/70 [overflow-anchor:none]">
          {queue.map((item, index) => (
            <SortableQueueItem key={item.game_id} item={item} index={index} {...rowProps} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <QueueItemRow
            item={activeItem}
            index={queue.findIndex((q) => q.game_id === activeId)}
            {...rowProps}
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
