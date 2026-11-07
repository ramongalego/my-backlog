'use client';

import { useState } from 'react';
import { growBar, useInView } from '@/hooks/useInView';
import type { Stats } from '@/hooks/useStatsPage';
import { SectionLabel } from '@/components/layout/Page';
import { Panel } from '@/components/ui/Panel';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { STATUS_STYLE } from '@/lib/games/status-style';
import { plural } from '@/components/stats/format';

type YearView = 'finished' | 'released';

export function YearChart({ stats }: { stats: Stats }) {
  const [view, setView] = useState<YearView>('finished');

  const data = view === 'finished' ? stats.finishedByYear : stats.gamesByReleaseYear;
  const max = data.length > 0 ? Math.max(...data.map((y) => y.count)) : 1;
  // Finished games without a date can't sit in a year; say so, so the bars add up.
  const undated = stats.finished - stats.finishedByYear.reduce((sum, y) => sum + y.count, 0);
  const { ref, inView } = useInView<HTMLDivElement>();

  const empty =
    view === 'finished'
      ? 'No finished games with dates yet.'
      : 'No release year data yet. Sync your library to fill this in.';

  return (
    <Panel className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Games by year</SectionLabel>
        <ToggleGroup
          variant="segmented"
          label="Group games by"
          value={view}
          onChange={setView}
          options={[
            { value: 'finished', label: 'Finished' },
            { value: 'released', label: 'Released' },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-ink-500">{empty}</p>
      ) : (
        <div ref={ref} className="flex-1 flex items-end gap-1.5 min-h-[160px]">
          {data.map(({ year, count }, i) => (
            <div key={year} className="self-stretch flex-1 flex flex-col items-center min-w-0">
              <div className="flex-1" />
              <span className="text-xs font-semibold text-ink-300 mb-1 tabular-nums">{count}</span>
              <div
                className={`w-full rounded-sm transition-colors ${growBar('y', inView, i).className} ${
                  view === 'finished'
                    ? `${STATUS_STYLE.finished.fill} opacity-80 hover:opacity-100`
                    : 'bg-ink-500 hover:bg-ink-400'
                }`}
                style={{
                  height: `${Math.max((count / max) * 65, 3)}%`,
                  ...growBar('y', inView, i).style,
                }}
              />
              <span
                className={`text-xs mt-1 tabular-nums ${data.length <= 14 || i % 2 === 0 ? 'text-ink-400' : 'invisible'}`}
              >
                {/* Short on phones, where four digits a bar run together. */}
                <span className="sm:hidden" aria-hidden="true">
                  &rsquo;{year.slice(2)}
                </span>
                <span className="max-sm:sr-only">{year}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {view === 'finished' && undated > 0 && data.length > 0 && (
        <p className="mt-4 text-xs text-ink-500">
          {plural(undated, 'finished game')} without a finish date{' '}
          {undated === 1 ? "isn't" : "aren't"} counted here.
        </p>
      )}
    </Panel>
  );
}
