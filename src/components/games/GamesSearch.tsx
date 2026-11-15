'use client';

import { fieldClass } from '@/components/ui/Input';
import { Search, X } from 'lucide-react';

interface GamesSearchProps {
  value: string;
  onSearchChange: (value: string) => void;
}

export function GamesSearch({ value, onSearchChange }: GamesSearchProps) {
  return (
    <div className="relative w-full min-w-0 sm:w-80">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name or tag…"
        aria-label="Search games by name or tag"
        className={`${fieldClass()} h-10 pl-9 pr-8 text-sm`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          // The padding makes it a 24px target around the same 16px icon.
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-ink-500 hover:text-ink-300 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
