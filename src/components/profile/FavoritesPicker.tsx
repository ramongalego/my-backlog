'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fieldClass } from '@/components/ui/Input';
import { CoverArt } from '@/components/games/CoverArt';
import { Rating } from '@/components/games/Rating';
import { SelectTick } from '@/components/games/SelectTick';
import type { GameItem } from '@/lib/data/loaders';
import { MAX_FAVORITES, favoriteChoices } from '@/lib/account/favorites';

/**
 * A mouse or trackpad: the search can take focus as the picker opens, since
 * typing straight away costs nothing. On a touchscreen that would bring the
 * keyboard up over the grid, which is what most people pick from.
 */
const hasFinePointer = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

/**
 * As many games as the grid draws at a time. It lists the whole library, but a
 * large one would be thousands of tiles built as the picker opens and again on
 * every letter of a search, so the next batch is drawn as the grid is scrolled
 * toward its end (as the Games page does). Whole rows at two, three and four
 * across.
 */
const BATCH = 48;

/** How many places are left, as the line under the title says it. */
function placesLeft(picked: number): string {
  const left = MAX_FAVORITES - picked;
  if (left === 0) return 'All four picked. Take one off to pick another.';
  if (picked === 0) return `Pick up to ${MAX_FAVORITES}`;
  return `${left} ${left === 1 ? 'place' : 'places'} left`;
}

/**
 * Picks the profile's favorite games from the library: a grid of art, all of
 * it, the highest rated first, searched by name or tag. A click picks a game
 * into the next place or takes it off, and each change is saved as it's made (the row
 * on the page behind shows it). It stays open until it's closed, with Done or
 * the X: filling the last place isn't the end of choosing.
 */
export function FavoritesPicker({
  games,
  pickedIds,
  onToggle,
  onClose,
  onOpenerGone,
}: {
  /** The library. */
  games: GameItem[];
  /** The picks now, in order. */
  pickedIds: readonly number[];
  /** Picks a game on or off (shown and saved by the page). */
  onToggle: (gameId: number) => void;
  onClose: () => void;
  /** The place that opened the picker was filled: where focus goes on close. */
  onOpenerGone?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [searchFirst] = useState(hasFinePointer);
  const [drawn, setDrawn] = useState(BATCH);
  const grid = useRef<HTMLUListElement>(null);
  const gridEnd = useRef<HTMLLIElement>(null);

  const full = pickedIds.length >= MAX_FAVORITES;
  const choices = favoriteChoices(games, query);
  const listed = choices.slice(0, drawn);
  const hasMore = drawn < choices.length;

  // Draws the next batch when the end of the grid is near. Set up again after
  // each batch (hence `drawn`): a new observer reports straight away, so a
  // batch that still leaves the end in reach is followed by another.
  useEffect(() => {
    const end = gridEnd.current;
    if (!end || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setDrawn((count) => count + BATCH);
      },
      { root: grid.current, rootMargin: '300px' },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasMore, drawn]);

  /** A new search starts from its first games, at the top of the grid. */
  function search(text: string) {
    setQuery(text);
    setDrawn(BATCH);
    if (grid.current) grid.current.scrollTop = 0;
  }

  return (
    // Held at the top: the grid under the search changes height as you type.
    <Modal
      isOpen
      onClose={onClose}
      onOpenerGone={onOpenerGone}
      title="Favorite games"
      size="2xl"
      align="top"
    >
      {/* Said as it changes: the row it describes is behind the dialog. */}
      <p className="text-sm text-ink-400" role="status">
        {placesLeft(pickedIds.length)}
      </p>

      <div className="relative mt-4">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search your games…"
          aria-label="Search your games"
          data-autofocus={searchFirst ? true : undefined}
          className={`${fieldClass()} h-10 pl-9 pr-3 text-sm`}
        />
      </div>

      {listed.length > 0 ? (
        // The padding keeps a picked game's ring inside the scrolling box.
        <ul
          ref={grid}
          className="-mx-1 mt-3 grid max-h-[min(30rem,55vh)] grid-cols-2 gap-x-3 gap-y-4 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4"
          aria-label="Your games"
        >
          {listed.map((game) => {
            const picked = pickedIds.includes(game.id);
            const blocked = full && !picked;
            const rating =
              game.status === 'finished' || game.status === 'dropped' ? game.rating : null;
            return (
              <li key={game.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={picked}
                  aria-disabled={blocked || undefined}
                  onClick={() => !blocked && onToggle(game.id)}
                  className={`group block w-full rounded-lg text-left ${
                    blocked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                  }`}
                >
                  <CoverArt
                    src={game.header_image}
                    alt=""
                    sizes="(max-width: 640px) 45vw, 180px"
                    interactive={!blocked}
                    className={picked ? 'ring-2 ring-ink-50 ring-offset-2 ring-offset-ink-900' : ''}
                  >
                    <SelectTick selected={picked} className="absolute top-1.5 left-1.5" />
                    {/* A space, so the rating isn't read as part of the name. */}{' '}
                    {rating != null && (
                      <Rating rating={rating} onArt className="absolute bottom-1.5 right-1.5" />
                    )}
                  </CoverArt>{' '}
                  {/* Two lines: one cuts a long name down to its series, and
                      two games of a series then read the same. */}
                  <span className="mt-1.5 line-clamp-2 text-sm text-ink-200">{game.name}</span>
                </button>
              </li>
            );
          })}
          {/* Where the grid ends for now: coming near it draws the next
              batch. Pulled up over the row gap, so it adds no height. */}
          {hasMore && <li ref={gridEnd} aria-hidden="true" className="col-span-full -mt-4 h-px" />}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-400">
          {query.trim()
            ? `No games match “${query.trim()}”`
            : 'Add games to your library to pick favorites'}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button type="button" onClick={onClose} className="cursor-pointer max-sm:w-full">
          Done
        </Button>
      </div>
    </Modal>
  );
}
