import { Dices } from 'lucide-react';
import { ArtShuffle } from '@/components/games/ArtShuffle';
import { COVER_ASPECT } from '@/components/games/CoverArt';
import { RANDOM_ROLL_MS } from '@/lib/games/random-pick';

/**
 * Home's band while Random picks a game: the backlog flicks past where the
 * game's art will be, laid out like the playing band it turns into.
 */
export function RandomRoll({ covers }: { covers: string[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] lg:grid-cols-[minmax(0,32rem)_1fr] md:gap-10 lg:gap-12 md:items-center">
      <div className={`relative ${COVER_ASPECT} overflow-hidden rounded-xl bg-ink-800`}>
        <ArtShuffle
          covers={covers}
          sizes="(max-width: 768px) 100vw, 512px"
          duration={RANDOM_ROLL_MS}
        />
      </div>
      <div className="min-w-0" role="status">
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink-300">
          <Dices className="w-7 h-7 shrink-0 text-accent-400 animate-pulse" aria-hidden="true" />
          Rolling the dice…
        </h1>
      </div>
    </div>
  );
}
