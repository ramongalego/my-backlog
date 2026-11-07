'use client';

import Image from 'next/image';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/games/StatusBadge';
import { useInView } from '@/hooks/useInView';
import { MOCK_LIBRARY } from './content';
import { riseIn } from './motion';
import { SectionCopy } from './SectionCopy';

/** A sample library, its rows settling in as it scrolls into view. */
export function LibraryPreview() {
  const { ref: libraryRowsRef, inView: libraryRowsInView } = useInView<HTMLDivElement>();

  return (
    <section className="border-t border-ink-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">
        <Panel
          padding="none"
          className="overflow-hidden order-last lg:order-first"
          // A sample, not the visitor's data: said so for screen readers.
          role="figure"
          aria-label="Example of your library"
        >
          <div className="px-5 py-4 border-b border-ink-800 flex items-center justify-between">
            <span className="text-sm font-medium text-ink-200">My Library</span>
            <span className="text-sm text-ink-400">457 games</span>
          </div>
          <div ref={libraryRowsRef} className="divide-y divide-ink-800/70">
            {MOCK_LIBRARY.map((game, i) => (
              <div
                key={game.title}
                className={`flex items-center gap-3.5 px-5 py-3 ${riseIn(libraryRowsInView, i).className}`}
                style={riseIn(libraryRowsInView, i).style}
              >
                <Image
                  src={game.image}
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-md object-cover shrink-0"
                />
                <span className="text-sm text-ink-200 flex-1 min-w-0 truncate">{game.title}</span>
                <span className="shrink-0">
                  <StatusBadge status={game.status} showBacklog />
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <SectionCopy title="Your whole gaming library in one place">
          <p>
            Years of sales add up to hundreds of games, and it&apos;s easy to lose track of what you
            own.
          </p>
          <p>
            Connect Steam to bring them all in, or add games from any console. Each one comes with
            how long it takes to beat and how well it&apos;s reviewed, ready to mark, rate and sort
            however you like.
          </p>
        </SectionCopy>
      </div>
    </section>
  );
}
