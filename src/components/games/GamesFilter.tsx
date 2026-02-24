'use client';

import type { GameFilter, FilterCounts } from '@/hooks/useGamesPage';

interface GamesFilterProps {
  filter: GameFilter;
  counts: FilterCounts;
  onFilterChange: (filter: GameFilter) => void;
}

const FILTERS: GameFilter[] = ['all', 'playing', 'backlog', 'finished', 'dropped', 'hidden'];

export function GamesFilter({ filter, counts, onFilterChange }: GamesFilterProps) {
  const visibleFilters = counts.playing > 0 ? FILTERS : FILTERS.filter((f) => f !== 'playing');

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
      {visibleFilters.map((f) => (
        <button
          key={f}
          onClick={() => onFilterChange(f)}
          className={`shrink-0 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
            filter === f
              ? 'bg-zinc-100 text-zinc-900'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
          }`}
        >
          {f.charAt(0).toUpperCase() + f.slice(1)}
          <span className="ml-1.5 text-xs opacity-60">{counts[f]}</span>
        </button>
      ))}
    </div>
  );
}
