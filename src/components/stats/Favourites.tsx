'use client';

import { CoverArt } from '@/components/games/CoverArt';
import { Rating } from '@/components/games/Rating';
import { growBar, useInView } from '@/hooks/useInView';
import type { Stats } from '@/lib/stats/compute';
import { Panel } from '@/components/ui/Panel';
import { plural } from '@/components/stats/format';
import { SectionTitle } from '@/components/stats/SectionTitle';

/** Your best-rated games as art, beside how your ratings spread. */
export function Favourites({ stats }: { stats: Stats }) {
  const { favourites, ratedCount, avgRating } = stats;
  const showBars = ratedCount >= 3;
  if (favourites.length === 0 && !showBars) return null;

  return (
    <Panel>
      {/* The heading sits in the games' column, so the ratings beside them
          centre on the whole panel, not just on the art. */}
      <div
        className={`grid gap-8 ${favourites.length > 0 && showBars ? 'lg:grid-cols-[minmax(0,1fr)_18rem]' : ''}`}
      >
        <div>
          <SectionTitle>Your favourites</SectionTitle>
          {favourites.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-4 content-start">
              {favourites.map((game) => (
                <li key={game.id} className="min-w-0">
                  <CoverArt
                    src={game.header_image}
                    alt=""
                    sizes="(max-width: 640px) 50vw, 220px"
                    className="w-full"
                  >
                    {game.rating != null && (
                      <Rating
                        rating={game.rating}
                        onArt
                        className="absolute bottom-1.5 right-1.5"
                      />
                    )}
                  </CoverArt>
                  <p className="mt-1.5 text-sm text-ink-200 truncate">{game.name}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {showBars && (
          <div className="lg:self-center">
            <p className="mb-4 text-sm text-ink-400">
              You average <span className="font-semibold text-ink-100">{avgRating}/10</span> across{' '}
              {plural(ratedCount, 'rated game')}
            </p>
            <RatingBars bars={stats.ratingDistribution} />
          </div>
        )}
      </div>
    </Panel>
  );
}

function RatingBars({ bars }: { bars: Stats['ratingDistribution'] }) {
  const max = Math.max(...bars.map((b) => b.count), 1);
  const BAR_MAX_HEIGHT = 80;
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex items-end gap-2">
      {bars.map(({ rating, count }, i) => (
        <div key={rating} className="flex-1 flex flex-col items-center gap-1.5">
          <span
            className={`text-xs font-semibold tabular-nums ${count > 0 ? 'text-ink-300' : 'text-transparent'}`}
          >
            {count}
          </span>
          <div
            className={`w-full rounded-sm transition-colors ${growBar('y', inView, i).className} ${count > 0 ? 'bg-amber-400/80 hover:bg-amber-400' : 'bg-ink-800'}`}
            style={{
              height: `${Math.max((count / max) * BAR_MAX_HEIGHT, count > 0 ? 4 : 2)}px`,
              ...growBar('y', inView, i).style,
            }}
          />
          <span className="text-xs text-ink-400 tabular-nums">{rating}</span>
        </div>
      ))}
    </div>
  );
}
