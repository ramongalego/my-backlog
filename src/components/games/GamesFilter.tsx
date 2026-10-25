'use client';

import type { GameFilter, FilterCounts } from '@/hooks/useGamesPage';

interface GamesFilterProps {
  filter: GameFilter;
  counts: FilterCounts;
  onFilterChange: (filter: GameFilter) => void;
}

const FILTER_LABELS: Record<GameFilter, string> = {
  all: 'All',
  backlog: 'Backlog',
  finished: 'Finished',
  dropped: 'Dropped',
  wont_play: "Won't Play",
  hidden: 'Hidden',
};

const FILTERS: GameFilter[] = ['all', 'backlog', 'finished', 'dropped', 'wont_play', 'hidden'];

export function GamesFilter({ filter, counts, onFilterChange }: GamesFilterProps) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto scrollbar-none"
      role="group"
      aria-label="Filter by status"
    >
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onFilterChange(f)}
          aria-pressed={filter === f}
          className={`shrink-0 h-8 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
            filter === f
              ? 'bg-ink-100 text-ink-950'
              : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800'
          }`}
        >
          <span>{FILTER_LABELS[f]}</span>
          <span
            className={`text-xs tabular-nums ${filter === f ? 'text-ink-600' : 'text-ink-500'}`}
          >
            {counts[f]}
          </span>
        </button>
      ))}
    </div>
  );
}
