'use client';

import { Search } from 'lucide-react';

interface GamesSearchProps {
  value: string;
  onSearchChange: (value: string) => void;
}

export function GamesSearch({ value, onSearchChange }: GamesSearchProps) {
  return (
    <div className='relative w-full sm:w-64'>
      <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500' />
      <input
        type='text'
        value={value}
        onChange={e => onSearchChange(e.target.value)}
        placeholder='Search games...'
        className='w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500 transition-colors'
      />
    </div>
  );
}
