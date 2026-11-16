'use client';

import Link from 'next/link';
import { Panel } from '@/components/ui/Panel';
import { SectionLabel } from '@/components/layout/Page';

/** As many platforms as the list names; the rest are counted in a last line. */
const SHOWN = 6;

/**
 * Where the library is played, the platform with the most games first. Each
 * opens the Games page listing that platform.
 */
export function PlaysOn({ platforms }: { platforms: { name: string; count: number }[] }) {
  if (platforms.length === 0) return null;
  const shown = platforms.slice(0, SHOWN);
  const more = platforms.length - shown.length;
  return (
    <Panel>
      <SectionLabel className="mb-3">Plays on</SectionLabel>
      <ul className="-mx-2">
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
      {more > 0 && (
        <p className="mt-2 text-xs text-ink-500">
          and {more} more {more === 1 ? 'platform' : 'platforms'}
        </p>
      )}
    </Panel>
  );
}
