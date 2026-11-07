'use client';

import Image from 'next/image';
import { Star } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { growBar, useInView } from '@/hooks/useInView';
import { BREAKDOWN } from './content';
import { CountUpPercent, riseIn } from './motion';
import { SectionCopy } from './SectionCopy';

/** The queue, the diary and stats, as a sample panel of each. */
export function ProgressPreview() {
  const { ref: queueRowsRef, inView: queueRowsInView } = useInView<HTMLOListElement>();
  const { ref: breakdownRef, inView: breakdownInView } = useInView<HTMLDivElement>();
  const breakdownBar = growBar('x', breakdownInView, 0);

  return (
    <section className="border-t border-ink-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">
        <SectionCopy title="A queue for what's next, a diary for what you finish">
          <p>Line up the next few games, so when you finish one you already know what to start.</p>
          <p>
            Every game you finish goes in your diary with the date, your rating and a note. Stats
            shows how much of your library you&apos;ve finished and how long the rest would take at
            your pace.
          </p>
        </SectionCopy>

        <Panel
          padding="none"
          className="divide-y divide-ink-800"
          role="figure"
          aria-label="Example of your queue, diary and stats"
        >
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-ink-200 mb-3">Up next</p>
            <ol ref={queueRowsRef} className="space-y-2.5">
              {[
                { name: 'Disco Elysium', image: '/lp_disco.jpeg' },
                { name: 'Outer Wilds', image: '/lp_outerwilds.jpg' },
                { name: 'Portal 2', image: '/lp_portal.jpg' },
              ].map((game, i) => (
                <li
                  key={game.name}
                  className={`flex items-center gap-3 ${riseIn(queueRowsInView, i).className}`}
                  style={riseIn(queueRowsInView, i).style}
                >
                  <span className="text-sm text-ink-500 w-3 shrink-0 tabular-nums">{i + 1}</span>
                  <Image
                    src={game.image}
                    alt=""
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded object-cover shrink-0"
                  />
                  <span className="text-sm text-ink-300">{game.name}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="px-5 py-4 flex items-start gap-4">
            <Image
              src="/lp_hk.jpeg"
              alt=""
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink-200">Hollow Knight</span>
                <span className="text-xs text-ink-400">Sep 2026</span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-200">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                10/10
              </p>
              <p className="mt-1 text-sm text-ink-400 truncate">
                One of the best I&apos;ve ever played.
              </p>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-sm font-medium text-ink-200 mb-3">Library breakdown</p>
            <div
              ref={breakdownRef}
              className={`flex h-2 rounded-full overflow-hidden gap-px ${breakdownBar.className}`}
              style={breakdownBar.style}
            >
              {BREAKDOWN.map((s) => (
                <div key={s.label} className={s.color} style={{ width: `${s.pct}%` }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {BREAKDOWN.map((s) => (
                <span key={s.label} className="flex items-center gap-2 text-sm text-ink-400">
                  <span className={`w-2 h-2 rounded-full ${s.color}`} aria-hidden="true" />
                  {s.label}
                  <span className="text-ink-200 font-medium tabular-nums">
                    <CountUpPercent to={s.pct} active={breakdownInView} />
                  </span>
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
