'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Plus, X } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { COVER_ASPECT, CoverArt } from '@/components/games/CoverArt';
import { Rating } from '@/components/games/Rating';
import { ProfileSection } from './ProfileSection';
import { FAVORITE_GRID, FAVORITE_SLOTS } from './profile-layout';
import { sameFavorites, type FavoriteGame } from '@/lib/account/favorites';

const ART_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px';

/** A favorite's art, rating and name: the same drawn whether or not it can be moved. */
function FavoriteArt({ game }: { game: FavoriteGame }) {
  return <CoverArt src={game.header_image} alt="" sizes={ART_SIZES} />;
}

/** The rating over the art's corner. Not part of what's dragged, so it's not in its name. */
function RatingChip({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  return (
    <Rating rating={rating} onArt className="pointer-events-none absolute bottom-1.5 right-1.5" />
  );
}

/**
 * A favorite the player picked: drag its art to move it (or pick it up with
 * Space and move it with the arrow keys), and take it off with the X in its
 * corner. The X shows on hover, and while the keyboard is on the favorite; a
 * click on the art gives it focus too, but that isn't a reason to keep the X
 * there until the next click elsewhere. A touchscreen has no hover, so there
 * it always shows.
 */
function PickedFavorite({
  game,
  place,
  total,
  onRemove,
  handleRef,
}: {
  game: FavoriteGame;
  /** 1 for the first. */
  place: number;
  total: number;
  onRemove: () => void;
  /** The art that moves it, for the row to put focus on. */
  handleRef?: Ref<HTMLDivElement>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: game.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`min-w-0 ${isDragging ? 'relative z-10' : ''}`}
    >
      <div className="group relative">
        {/* The art is the handle. A long press picks it up on a touchscreen,
            so a swipe across it still scrolls the page. */}
        <div
          ref={handleRef}
          {...attributes}
          {...listeners}
          aria-label={`${game.name}, favorite ${place} of ${total}`}
          className={`touch-manipulation select-none rounded-lg [-webkit-touch-callout:none] ${
            isDragging ? 'cursor-grabbing shadow-xl shadow-black/40' : 'cursor-grab'
          }`}
        >
          <FavoriteArt game={game} />
        </div>
        <RatingChip rating={game.rating} />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${game.name} from your favorites`}
          // The close button's small twin: a dark disc, 24px to hit. Under a
          // finger it takes the 8px around it too (40px), the disc no bigger.
          className="absolute top-1.5 right-1.5 cursor-pointer rounded-full bg-ink-950/80 p-1 text-ink-200 opacity-0 transition-[opacity,color,background-color] hover:bg-ink-950 hover:text-ink-50 focus-visible:opacity-100 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:before:absolute [@media(hover:none)]:before:-inset-2 [@media(hover:none)]:before:content-['']"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {/* Wrapped where the art is narrow: a long name cut short there is
          mostly its series. */}
      <p className="mt-1.5 text-sm text-ink-200 lg:truncate">{game.name}</p>
    </li>
  );
}

/** An empty place: opens the picker to fill it. */
function EmptyPlace({
  onChoose,
  buttonRef,
}: {
  onChoose: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        onClick={onChoose}
        aria-label="Add a favorite game"
        className={`${COVER_ASPECT} flex w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink-700 text-ink-500 transition-colors hover:border-ink-500 hover:bg-ink-800/40 hover:text-ink-300`}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
    </li>
  );
}

/** What the page can ask of the row. */
export interface FavoriteGamesHandle {
  /** Puts focus on the row: its first empty place, or its last favorite when it's full. */
  focus: () => void;
}

/**
 * Four games the player loves, as art, picked by them: the row starts as four
 * empty places and is theirs to fill and arrange where it is. An empty place
 * opens the picker, dragging reorders, and the X takes one off. A row with
 * fewer than four keeps its empty places. (With four, one comes off before
 * another goes on: there's no other way into the picker, and none is needed.)
 */
export function FavoriteGames({
  games: saved,
  onChoose,
  onReorder,
  onRemove,
  ref,
}: {
  ref?: Ref<FavoriteGamesHandle>;
  games: FavoriteGame[];
  onChoose: () => void;
  /** The picks in their new order, after a drag. */
  onReorder: (gameIds: number[]) => void;
  onRemove: (game: FavoriteGame) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Held for a moment before it lifts: a quick swipe is a scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // The order just dropped, shown from the instant of the drop. The page's
  // own copy catches up a moment later, and in that moment the drag library
  // would animate the favorites from where they no longer are: the game
  // beside the one moved slid out of the row and back. Kept only until the
  // page's order changes from what it was at the drop, whatever it changes to
  // (the new order, or the old one again if the save failed).
  const [dropped, setDropped] = useState<{ from: number[]; order: number[] } | null>(null);
  const savedIds = saved.map((game) => game.id);
  if (dropped && !sameFavorites(savedIds, dropped.from)) setDropped(null);
  const showDropped = dropped && sameFavorites(savedIds, dropped.from);
  const games = showDropped
    ? dropped.order.flatMap((id) => saved.find((game) => game.id === id) ?? [])
    : saved;

  const ids = games.map((game) => game.id);
  // What a screen reader hears while a favorite is moved from the keyboard:
  // its name and place, not dnd-kit's ids.
  const nameOf = (id: UniqueIdentifier) => games.find((game) => game.id === id)?.name ?? 'The game';
  const placeOf = (id: UniqueIdentifier) =>
    `place ${ids.indexOf(id as number) + 1} of ${ids.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} moved to ${placeOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      `${nameOf(active.id)} dropped at ${placeOf(over?.id ?? active.id)}.`,
    onDragCancel: ({ active }) =>
      `Move canceled. ${nameOf(active.id)} stays at ${placeOf(active.id)}.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id as number);
    const to = ids.indexOf(over.id as number);
    if (from === -1 || to === -1) return;
    const order = arrayMove(ids, from, to);
    setDropped({ from: savedIds, order });
    onReorder(order);
  }

  const firstEmpty = useRef<HTMLButtonElement>(null);
  const lastFavorite = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => (firstEmpty.current ?? lastFavorite.current)?.focus(),
  }));

  // Taking a favorite off takes its X with it, and focus with the X. It goes
  // to the empty place that opens in the row instead of back to the page,
  // unless it has gone somewhere else in the meantime.
  const removedAt = useRef<number | null>(null);
  useEffect(() => {
    if (removedAt.current === null || saved.length >= removedAt.current) return;
    removedAt.current = null;
    if (document.activeElement === document.body) firstEmpty.current?.focus();
  }, [saved.length]);

  function handleRemove(game: FavoriteGame) {
    removedAt.current = saved.length;
    onRemove(game);
  }

  const emptyPlaces = Array.from({ length: Math.max(0, FAVORITE_SLOTS - games.length) }, (_, i) => (
    <EmptyPlace
      key={`empty-${i}`}
      onChoose={onChoose}
      buttonRef={i === 0 ? firstEmpty : undefined}
    />
  ));

  return (
    <ProfileSection id="profile-favorites" title="Favorite games">
      <DndContext
        id="favorites-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <ul className={FAVORITE_GRID}>
            {games.map((game, i) => (
              <PickedFavorite
                key={game.id}
                game={game}
                place={i + 1}
                total={games.length}
                onRemove={() => handleRemove(game)}
                handleRef={i === games.length - 1 ? lastFavorite : undefined}
              />
            ))}
            {emptyPlaces}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="mt-3 text-sm text-ink-500">Drag to reorder</p>
    </ProfileSection>
  );
}
