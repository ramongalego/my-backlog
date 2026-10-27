'use client';

import { useState } from 'react';
import { Dices, Sparkles } from 'lucide-react';
import { ArtShuffle } from '@/components/games/ArtShuffle';
import { prefersReducedMotion } from '@/lib/motion';
import { RANDOM_ROLL_MS } from '@/lib/games/random-pick';

/**
 * While a game is picked: art from your backlog flicks past in the frame the
 * picked game will land in, like shuffling through the shelf. Without art to
 * show (or with reduced motion), a spinner. `roll` is a random pick: the art
 * slows to a stop over the roll's set length.
 */
export function SuggestionLoading({
  covers = [],
  roll = false,
}: {
  covers?: string[];
  roll?: boolean;
}) {
  const [reduceMotion] = useState(prefersReducedMotion);
  const label = roll ? 'Rolling the dice…' : 'Picking a game from your backlog…';
  const Icon = roll ? Dices : Sparkles;

  if (covers.length < 2 || reduceMotion) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-ink-700 border-t-ink-300 rounded-full animate-spin" />
          <Icon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-accent-400" />
        </div>
        <p className="mt-6 text-ink-400 text-center" role="status">
          {label}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* The same frame as the result's art, so the pick lands in place. */}
      <div className="relative -mx-6 -mt-6 h-44 overflow-hidden rounded-t-2xl bg-ink-800">
        <ArtShuffle
          covers={covers}
          sizes="(max-width: 640px) 100vw, 544px"
          duration={roll ? RANDOM_ROLL_MS : undefined}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/50 to-ink-900/10" />
      </div>
      <div className="flex items-center justify-center gap-2 py-10 text-ink-400" role="status">
        <Icon className="w-4 h-4 text-accent-400 animate-pulse" aria-hidden="true" />
        <p>{label}</p>
      </div>
    </>
  );
}
