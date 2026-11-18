'use client';

import { ListChecks } from 'lucide-react';

export function GamesSelectToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium cursor-pointer transition-colors ${
        on
          ? 'bg-ink-100 text-ink-950'
          : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50'
      }`}
    >
      <ListChecks className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Select</span>
    </button>
  );
}
