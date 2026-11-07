'use client';

import { useState } from 'react';
import { Figure, Lead } from '@/components/ui/Lead';
import type { Stats } from '@/hooks/useStatsPage';
import { Panel } from '@/components/ui/Panel';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { formatYears, plural } from '@/components/stats/format';
import { SectionTitle } from '@/components/stats/SectionTitle';
import { LibraryBreakdown } from '@/components/stats/LibraryBreakdown';

// How soon you'd like the backlog cleared, for the hours-a-week figure, in
// months.
type ClearIn = '60' | '48' | '36' | '24' | '12' | '6';
const CLEAR_IN: DropdownOption<ClearIn>[] = [
  { value: '60', label: '5 years' },
  { value: '48', label: '4 years' },
  { value: '36', label: '3 years' },
  { value: '24', label: '2 years' },
  { value: '12', label: '1 year' },
  { value: '6', label: '6 months' },
];
const WEEKS_A_MONTH = 52 / 12;

/**
 * The choice to start on: the longest that's still sooner than your pace, since
 * clearing it later than you already would says nothing. Five years without a pace.
 */
function defaultClearIn(yearsAtPace: number | null): ClearIn {
  if (yearsAtPace === null) return '60';
  return CLEAR_IN.find((option) => Number(option.value) < yearsAtPace * 12)?.value ?? '6';
}

/**
 * How long the backlog would take at your recent finishing rate, what it would
 * take to clear it sooner, and the library it sits in.
 */
export function BacklogPace({ stats }: { stats: Stats }) {
  const { backlog, finishedLastYear, estimatedBacklogHours } = stats;
  const [clearIn, setClearIn] = useState<ClearIn>(() =>
    defaultClearIn(finishedLastYear > 0 ? backlog / finishedLastYear : null),
  );
  const perWeek = Math.max(
    1,
    Math.round(estimatedBacklogHours / (Number(clearIn) * WEEKS_A_MONTH)),
  );
  return (
    <Panel>
      <SectionTitle>Backlog pace</SectionTitle>
      {finishedLastYear > 0 ? (
        <Lead>
          At {plural(finishedLastYear, 'game')} finished in the last year, your{' '}
          {plural(backlog, 'backlog game')} {backlog === 1 ? 'takes' : 'take'}{' '}
          <Figure>{formatYears(backlog / finishedLastYear)}</Figure> to clear.
        </Lead>
      ) : (
        <p className="text-ink-300 max-w-xl">
          You haven&apos;t finished a game in the last 12 months. Finish one to see how long your
          backlog would take at your pace.
        </p>
      )}
      {estimatedBacklogHours > 0 && (
        // A div, not a p: the choice of time opens a list. The choice starts its
        // own line, so picking a longer one doesn't push the text onto another.
        <div className="mt-2 text-ink-400 max-w-xl">
          That&apos;s ~{plural(estimatedBacklogHours, 'hour')} of story.{' '}
          <br className="hidden sm:inline" />
          Clearing it in{' '}
          <Dropdown
            inline
            align="left"
            value={clearIn}
            options={CLEAR_IN}
            onChange={setClearIn}
            aria-label="Clear it in"
          />{' '}
          takes about <span className="tabular-nums">{plural(perWeek, 'hour')}</span> a week.
        </div>
      )}
      <LibraryBreakdown stats={stats} />
    </Panel>
  );
}
