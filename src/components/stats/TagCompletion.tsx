'use client';

import { Figure } from '@/components/ui/Lead';
import { growBar, useInView } from '@/hooks/useInView';
import type { Stats } from '@/lib/stats/compute';
import { Panel } from '@/components/ui/Panel';
import { STATUS_STYLE } from '@/lib/games/status-style';
import { SectionTitle } from '@/components/stats/SectionTitle';

// "turn-based strategy games", but "JRPG games" and "2D games".
const tagNoun = (tag: string) => (/^[A-Z0-9-]+$/.test(tag) ? tag : tag.toLowerCase());

export function TagCompletion({ stats }: { stats: Stats }) {
  const { tagCompletion, finishContrast } = stats;
  if (tagCompletion.length === 0) return null;

  return (
    <Panel>
      <SectionTitle>What you finish</SectionTitle>
      {finishContrast ? (
        <p className="-mt-1 mb-6 max-w-2xl text-ink-300">
          You finish <Figure>{finishContrast.high.pct}%</Figure> of the{' '}
          {tagNoun(finishContrast.high.tag)} games you own, but only{' '}
          <Figure>{finishContrast.low.pct}%</Figure> of the {tagNoun(finishContrast.low.tag)} ones.
        </p>
      ) : (
        <p className="text-sm text-ink-400 mb-5 -mt-2">Tags with 3+ games in your library</p>
      )}
      <TagCompletionGrid tags={tagCompletion} />
    </Panel>
  );
}

function TagCompletionGrid({ tags }: { tags: Stats['tagCompletion'] }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
      {tags.map(({ tag, total, finished, pct }, i) => (
        <div key={tag} className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-ink-200 truncate">{tag}</span>
            <span
              className={`text-sm font-semibold tabular-nums shrink-0 ${pct >= 50 ? 'text-emerald-400' : 'text-ink-300'}`}
            >
              {pct}%
            </span>
          </div>
          <div className="mt-2 h-1 bg-ink-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${STATUS_STYLE.finished.fill} ${growBar('x', inView, i).className}`}
              style={{ width: `${pct}%`, ...growBar('x', inView, i).style }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-500 tabular-nums">
            {finished} of {total} finished
          </p>
        </div>
      ))}
    </div>
  );
}
