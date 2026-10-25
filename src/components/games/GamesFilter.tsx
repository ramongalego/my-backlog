'use client';

import { ToggleGroup } from '@/components/ui/ToggleGroup';
import type { GameFilter, FilterCounts } from '@/hooks/useGamesPage';
import { STATUS_STYLE } from '@/lib/games/status-style';

interface GamesFilterProps {
  filter: GameFilter;
  counts: FilterCounts;
  onFilterChange: (filter: GameFilter) => void;
}

const FILTERS: GameFilter[] = ['all', 'backlog', 'finished', 'dropped', 'wont_play', 'hidden'];

export function GamesFilter({ filter, counts, onFilterChange }: GamesFilterProps) {
  return (
    <ToggleGroup
      label="Filter by status"
      wrap={false}
      value={filter}
      onChange={onFilterChange}
      options={FILTERS.map((f) => ({
        value: f,
        label: f === 'all' ? 'All' : STATUS_STYLE[f].label,
        count: counts[f],
      }))}
    />
  );
}
