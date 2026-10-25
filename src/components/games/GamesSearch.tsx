'use client';

import { Search, X } from 'lucide-react';

interface GamesSearchProps {
  value: string;
  onSearchChange: (value: string) => void;
}

export function GamesSearch({ value, onSearchChange }: GamesSearchProps) {
  return (
    <div className="relative w-full sm:w-80">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name or tag..."
        aria-label="Search games by name or tag"
        className="w-full h-10 pl-9 pr-8 bg-ink-900 border border-ink-800 rounded-lg text-ink-100 placeholder-ink-500 text-sm focus:outline-none focus:border-ink-600 transition-colors"
      />
      {value && (
        <button
          onClick={() => onSearchChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
