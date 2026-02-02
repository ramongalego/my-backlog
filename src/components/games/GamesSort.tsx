'use client';

import { ArrowUpDown } from 'lucide-react';
import type { GameSort } from '@/hooks/useGamesPage';

interface GamesSortProps {
  value: GameSort;
  onChange: (sort: GameSort) => void;
}

const SORT_OPTIONS: { value: GameSort; label: string }[] = [
  { value: 'playtime', label: 'Most Played' },
  { value: 'score', label: 'Highest Rated' },
  { value: 'recent', label: 'Most Recent' },
];

export function GamesSort({ value, onChange }: GamesSortProps) {
  return (
    <div className='flex items-center gap-2'>
      <ArrowUpDown className='w-4 h-4 text-zinc-500' />
      <select
        value={value}
        onChange={e => onChange(e.target.value as GameSort)}
        className='appearance-none bg-transparent text-zinc-400 text-sm focus:outline-none cursor-pointer hover:text-zinc-200 transition-colors'
      >
        {SORT_OPTIONS.map(option => (
          <option key={option.value} value={option.value} className='bg-zinc-900'>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
