'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { GameArt } from '@/components/games/GameArt';

// How long each game's art shows while the pick is being made.
const FLICK_MS = 130;

/**
 * While a game is picked: art from your backlog flicks past in the frame the
 * picked game will land in, like shuffling through the shelf. Without art to
 * show (or with reduced motion), a spinner.
 */
export function SuggestionLoading({ covers = [] }: { covers?: string[] }) {
  const [index, setIndex] = useState(0);
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const shuffling = covers.length >= 2 && !reduceMotion;

  useEffect(() => {
    if (!shuffling) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % covers.length), FLICK_MS);
    return () => clearInterval(timer);
  }, [shuffling, covers.length]);

  if (!shuffling) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-ink-700 border-t-ink-300 rounded-full animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-accent-400" />
        </div>
        <p className="mt-6 text-ink-400 text-center">Picking a game from your backlog…</p>
      </div>
    );
  }

  return (
    <>
      {/* The same frame as the result's art, so the pick lands in place. All
          the art is loaded up front; only the current one shows. */}
      <div className="relative -mx-6 -mt-6 h-44 overflow-hidden rounded-t-2xl bg-ink-800">
        {covers.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 blur-[1px] ${i === index ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden="true"
          >
            <GameArt src={src} alt="" sizes="(max-width: 640px) 100vw, 544px" />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/50 to-ink-900/10" />
      </div>
      <div className="flex items-center justify-center gap-2 py-10 text-ink-400" role="status">
        <Sparkles className="w-4 h-4 text-accent-400 animate-pulse" aria-hidden="true" />
        <p>Picking a game from your backlog…</p>
      </div>
    </>
  );
}
