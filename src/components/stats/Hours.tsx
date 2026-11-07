'use client';

import { CoverArt } from '@/components/games/CoverArt';
import { Figure, Lead } from '@/components/ui/Lead';
import type { Stats } from '@/lib/stats/compute';
import { count, plural } from '@/components/stats/format';

/** Where the hours went: the total, then the games that took most of them. */
export function Hours({ stats }: { stats: Stats }) {
  const { totalPlaytimeHours: hours, totalPlaytimeDays: days, mostPlayed } = stats;
  if (hours === 0) return null;
  return (
    <section aria-label="Hours played">
      <Lead>
        You&apos;ve played for <Figure>{plural(hours, 'hour')}</Figure>
        {days >= 2 && (
          <>
            , about <Figure>{Math.round(days)} days</Figure> of your life
          </>
        )}
        .{mostPlayed.length > 0 && ' Most of them went here.'}
      </Lead>
      {mostPlayed.length > 0 && (
        <ol className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
          {mostPlayed.map((game, i) => {
            const share = Math.round((game.hours / hours) * 100);
            return (
              <li key={game.id} className={i === 0 ? 'col-span-2 lg:row-span-2' : 'min-w-0'}>
                <CoverArt
                  src={game.header_image}
                  alt=""
                  rounded="xl"
                  preload={i === 0}
                  sizes={
                    i === 0 ? '(max-width: 1024px) 100vw, 640px' : '(max-width: 1024px) 50vw, 320px'
                  }
                  className="w-full"
                />
                <p
                  className={`mt-2 font-medium text-ink-100 truncate ${i === 0 ? 'text-lg' : 'text-sm'}`}
                >
                  {game.name}
                </p>
                <p className="text-sm text-ink-400 tabular-nums">
                  {count(game.hours)}h{share > 0 && ` · ${share}% of your hours`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
