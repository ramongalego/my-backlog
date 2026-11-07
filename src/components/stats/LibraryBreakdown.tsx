'use client';

import { growBar, useInView } from '@/hooks/useInView';
import type { Stats } from '@/lib/stats/compute';
import { STATUS_STYLE } from '@/lib/games/status-style';

export function LibraryBreakdown({ stats }: { stats: Stats }) {
  const segments = [
    {
      label: 'Finished',
      pct: stats.finishedPct,
      count: stats.finished,
      color: STATUS_STYLE.finished.fill,
    },
    {
      label: 'Dropped',
      pct: stats.droppedPct,
      count: stats.dropped,
      color: STATUS_STYLE.dropped.fill,
    },
    {
      label: 'Backlog',
      pct: stats.backlogPct,
      count: stats.backlog,
      color: STATUS_STYLE.backlog.fill,
    },
  ].filter((s) => s.count > 0);
  const { ref, inView } = useInView<HTMLDivElement>();
  const grow = growBar('x', inView, 0);

  return (
    <div className="mt-6">
      <div
        ref={ref}
        className={`flex h-2.5 rounded-full overflow-hidden gap-px mb-4 ${grow.className}`}
        style={grow.style}
      >
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} transition-all`}
            style={{ width: `${s.pct}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${s.color}`} aria-hidden="true" />
            <span className="text-sm text-ink-400">{s.label}</span>
            <span className="text-sm font-semibold text-ink-100 tabular-nums">{s.count}</span>
            <span className="text-xs text-ink-500 tabular-nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
