'use client';

import { ArrowUpDown } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import type { GameSort } from '@/hooks/useGamesPage';

interface GamesSortProps {
  value: GameSort;
  onChange: (sort: GameSort) => void;
}

const SORT_OPTIONS = [
  { value: 'playtime' as GameSort, label: 'Most Played' },
  { value: 'score' as GameSort, label: 'Highest Rated' },
  { value: 'recent' as GameSort, label: 'Most Recent' },
];

export function GamesSort({ value, onChange }: GamesSortProps) {
  return (
    <Dropdown
      value={value}
      options={SORT_OPTIONS}
      onChange={onChange}
      icon={<ArrowUpDown className="w-4 h-4 text-zinc-500" />}
      align="left"
    />
  );
}
