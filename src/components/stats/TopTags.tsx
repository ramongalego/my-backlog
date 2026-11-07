'use client';

import { growBar, useInView } from '@/hooks/useInView';
import type { Stats } from '@/lib/stats/compute';
import { Panel } from '@/components/ui/Panel';
import { SectionTitle } from '@/components/stats/SectionTitle';

export function TopTags({ stats, syncs }: { stats: Stats; syncs: boolean }) {
  if (stats.topTags.length === 0) {
    return (
      <Panel>
        <SectionTitle>Top tags in your library</SectionTitle>
        <p className="text-sm text-ink-500">
          {syncs
            ? 'No tags yet. They’re added the next time your library syncs.'
            : 'None of your games have tags yet.'}
        </p>
      </Panel>
    );
  }

  const max = stats.topTags[0].count;

  return (
    <Panel>
      <SectionTitle>Top tags in your library</SectionTitle>
      <TopTagBars tags={stats.topTags} max={max} />
    </Panel>
  );
}

function TopTagBars({ tags, max }: { tags: Stats['topTags']; max: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="space-y-3">
      {tags.map(({ tag, count }, i) => (
        <div key={tag} className="flex items-center gap-3">
          <span className="text-sm text-ink-300 w-32 truncate shrink-0">{tag}</span>
          <div className="flex-1 h-1.5 bg-ink-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-ink-400 rounded-full ${growBar('x', inView, i).className}`}
              style={{ width: `${(count / max) * 100}%`, ...growBar('x', inView, i).style }}
            />
          </div>
          <span className="text-xs text-ink-400 w-6 text-right shrink-0 tabular-nums">{count}</span>
        </div>
      ))}
    </div>
  );
}
