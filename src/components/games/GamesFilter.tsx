'use client';

import { type ReactNode } from 'react';
import { Layers, Play, Inbox, Trophy, X, EyeOff } from 'lucide-react';
import type { GameFilter, FilterCounts } from '@/hooks/useGamesPage';

interface GamesFilterProps {
  filter: GameFilter;
  counts: FilterCounts;
  onFilterChange: (filter: GameFilter) => void;
}

const FILTER_CONFIG: Record<GameFilter, { label: string; icon: ReactNode }> = {
  all: { label: 'All', icon: <Layers className="w-3.5 h-3.5" /> },
  playing: { label: 'Playing', icon: <Play className="w-3.5 h-3.5" /> },
  backlog: { label: 'Backlog', icon: <Inbox className="w-3.5 h-3.5" /> },
  finished: { label: 'Finished', icon: <Trophy className="w-3.5 h-3.5" /> },
  dropped: { label: 'Dropped', icon: <X className="w-3.5 h-3.5" /> },
  hidden: { label: 'Hidden', icon: <EyeOff className="w-3.5 h-3.5" /> },
};

const FILTERS: GameFilter[] = ['all', 'playing', 'backlog', 'finished', 'dropped', 'hidden'];

export function GamesFilter({ filter, counts, onFilterChange }: GamesFilterProps) {
  const visibleFilters = counts.playing > 0 ? FILTERS : FILTERS.filter((f) => f !== 'playing');

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
      {visibleFilters.map((f) => {
        const { label, icon } = FILTER_CONFIG[f];
        return (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === f
                ? 'bg-zinc-100 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <span className="flex items-center">{icon}</span>
            <span>{label}</span>
            <span className="text-xs opacity-60">{counts[f]}</span>
          </button>
        );
      })}
    </div>
  );
}
