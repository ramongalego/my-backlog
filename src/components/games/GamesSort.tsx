'use client';

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { Tooltip, TooltipText } from '@/components/ui/Tooltip';
import { SORT_DIRECTIONS, sortsAscending, type GameSort } from '@/lib/games/library-filter';

interface GamesSortProps {
  value: GameSort;
  onChange: (sort: GameSort) => void;
  /** The sort runs the other way from its usual. */
  reversed: boolean;
  onReverse: () => void;
}

const SORT_OPTIONS = [
  { value: 'score' as GameSort, label: 'Rating' },
  { value: 'rating' as GameSort, label: 'My Rating' },
  { value: 'recent' as GameSort, label: 'Recently Added' },
  { value: 'released' as GameSort, label: 'Release Date' },
  { value: 'playtime' as GameSort, label: 'Most Played' },
  { value: 'length' as GameSort, label: 'Game Length' },
];

/**
 * What the Games page is sorted by, and which way: the arrow shows the order
 * and reverses it, in the grid and the list alike. Picking another sort
 * starts it in its usual order (highest rated, newest, shortest first).
 */
export function GamesSort({ value, onChange, reversed, onReverse }: GamesSortProps) {
  const [now, other] = reversed ? [...SORT_DIRECTIONS[value]].reverse() : SORT_DIRECTIONS[value];
  const Arrow = sortsAscending(value, reversed) ? ArrowUpNarrowWide : ArrowDownWideNarrow;
  return (
    <div className="flex items-center gap-1">
      <Tooltip content={<TooltipText title={now} detail={`Click for ${other.toLowerCase()}`} />}>
        <button
          type="button"
          onClick={onReverse}
          aria-label={`${now}. Reverse the order`}
          className="flex items-center justify-center h-10 w-8 rounded-md text-ink-400 hover:text-ink-50 transition-colors cursor-pointer"
        >
          <Arrow className="w-4 h-4" aria-hidden="true" />
        </button>
      </Tooltip>
      <Dropdown
        value={value}
        options={SORT_OPTIONS}
        onChange={onChange}
        align="responsive"
        aria-label="Sort by"
      />
    </div>
  );
}
