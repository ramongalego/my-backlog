'use client';

import type { GameSelection } from './GameCard';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { GameItem } from '@/lib/data/loaders';
import { SORT_DIRECTIONS, sortsAscending, type GameSort } from '@/lib/games/library-filter';
import { GameListRow } from './GameListRow';
import { LIST_COLUMN, LIST_ROW, LIST_THUMB } from './game-list-columns';

interface GameListProps {
  games: GameItem[];
  queuedGameIds: Set<number>;
  showStatus: boolean;
  sort: GameSort;
  /** The sort runs the other way from its usual (e.g. lowest rating first). */
  reversed: boolean;
  /** A heading was clicked: sort by it, or reverse it when it's the sort already. */
  onSortChange: (sort: GameSort) => void;
  onOpenDetail: (gameId: number) => void;
  /** Select mode: each game's part in it. */
  selectionFor?: (game: GameItem) => GameSelection;
}

/**
 * The Games page's list view: a row per game, under a header that names the
 * columns. A column that has a sort sorts by it, the same sorts as the Sort
 * menu; clicking the one in use reverses it, as the arrow beside Sort does.
 */
export function GameList({
  games,
  queuedGameIds,
  showStatus,
  sort,
  reversed,
  onSortChange,
  onOpenDetail,
  selectionFor,
}: GameListProps) {
  const column = (label: string, by: GameSort, className: string) => (
    <SortColumn
      label={label}
      by={by}
      sort={sort}
      reversed={reversed}
      onSortChange={onSortChange}
      className={className}
    />
  );
  return (
    <div>
      <div
        role="group"
        aria-label="Sort by"
        className={`hidden lg:flex ${LIST_ROW} h-9 border-b border-ink-800 text-xs text-ink-500`}
      >
        <span className={`${LIST_THUMB} shrink-0`} />
        <span className="flex-1">Game</span>
        {showStatus && <span className={LIST_COLUMN.status}>Status</span>}
        {column('Time to beat', 'length', LIST_COLUMN.toBeat)}
        {column('Rating', 'score', LIST_COLUMN.rating)}
        {column('Played', 'playtime', LIST_COLUMN.played)}
        {column('My rating', 'rating', LIST_COLUMN.myRating)}
      </div>
      <ul className="mt-1 lg:mt-2">
        {games.map((game) => (
          <GameListRow
            key={game.id}
            game={game}
            onOpenDetail={onOpenDetail}
            queued={queuedGameIds.has(game.id)}
            showStatus={showStatus}
            selection={selectionFor?.(game)}
          />
        ))}
      </ul>
    </div>
  );
}

function SortColumn({
  label,
  by,
  sort,
  reversed,
  onSortChange,
  className,
}: {
  label: string;
  by: GameSort;
  sort: GameSort;
  reversed: boolean;
  onSortChange: (sort: GameSort) => void;
  className: string;
}) {
  const active = sort === by;
  const Arrow = sortsAscending(by, reversed) ? ArrowUp : ArrowDown;
  return (
    <span className={className}>
      <button
        type="button"
        onClick={() => onSortChange(by)}
        aria-pressed={active}
        className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${
          active ? 'text-ink-100' : 'hover:text-ink-200'
        }`}
      >
        {active && <Arrow className="w-3 h-3" aria-hidden="true" />}
        {label}
        {active && <span className="sr-only">, {SORT_DIRECTIONS[by][reversed ? 1 : 0]}</span>}
      </button>
    </span>
  );
}
