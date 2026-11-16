'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { SectionLabel } from '@/components/layout/Page';

/** As many platforms as the list names until it's opened up. */
const SHOWN = 5;

/**
 * Where the library is played, the platform with the most games first. Each
 * opens the Games page listing that platform. Past five, the rest are counted
 * in a line that opens the list up to all of them, and closes it again. One
 * left over isn't worth a click: it's shown.
 */
export function PlaysOn({ platforms }: { platforms: { name: string; count: number }[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (platforms.length === 0) return null;

  const folds = platforms.length > SHOWN + 1;
  const shown = folds && !open ? platforms.slice(0, SHOWN) : platforms;
  const more = platforms.length - SHOWN;

  return (
    <Panel>
      <SectionLabel className="mb-3">Plays on</SectionLabel>
      <ul id={listId} className="-mx-2">
        {shown.map(({ name, count }) => (
          <li key={name}>
            <Link
              href={`/games?platform=${encodeURIComponent(name)}`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-50"
            >
              <span className="min-w-0 truncate">{name}</span>{' '}
              <span className="text-xs tabular-nums text-ink-500">
                {count}
                <span className="sr-only"> {count === 1 ? 'game' : 'games'}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {folds && (
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
          aria-controls={listId}
          // py-1 -my-1: about 24px to hit without moving anything.
          className="-my-1 mt-1 flex cursor-pointer items-center gap-1 py-1 text-xs font-medium text-ink-400 transition-colors hover:text-ink-100"
        >
          {open ? 'Show fewer' : `and ${more} more platforms`}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    </Panel>
  );
}
