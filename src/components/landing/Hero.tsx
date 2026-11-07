'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { AuthMode } from '@/types/auth';
import { HERO_SHELF, HERO_TEASES } from './content';
import { GetStartedButton } from './GetStartedButton';

/** The headline, a tagline that changes, sign-up and sign-in, and a shelf of box art. */
export function Hero({ onOpen }: { onOpen: (mode: AuthMode) => void }) {
  const [teaseIndex, setTeaseIndex] = useState(0);

  useEffect(() => {
    // Keep the first tagline still for users who asked for reduced motion.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setTeaseIndex((i) => (i + 1) % HERO_TEASES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,26rem)] gap-14 lg:gap-20 items-center">
        <div>
          {/* Sized so each half fits on one line, including the narrower two-column range. */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-semibold text-ink-50 leading-[1.05] tracking-tight">
            Play the games
            <br />
            <span className="text-accent-400">you already own</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-ink-300 max-w-lg leading-relaxed">
            MyBacklog imports your Steam library, or the games you add from any console, and picks
            one for tonight based on your mood and how much time you have
          </p>
          <p className="mt-3 text-sm text-ink-400 h-5 leading-5" aria-live="off">
            <span
              key={teaseIndex}
              className="inline-block animate-[resultPop_0.3s_ease-out] motion-reduce:animate-none"
            >
              {HERO_TEASES[teaseIndex]}
            </span>
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <GetStartedButton onClick={() => onOpen('signup')} />
            <button
              aria-haspopup="dialog"
              onClick={() => onOpen('login')}
              className="text-sm text-ink-400 hover:text-ink-100 transition-colors cursor-pointer"
            >
              Already have an account?{' '}
              <span className="font-medium text-ink-200 underline decoration-ink-600 underline-offset-4">
                Sign in
              </span>
            </button>
          </div>
        </div>

        {/* Shelf of box art */}
        <div
          className="grid grid-cols-3 gap-3 sm:gap-4 max-w-sm sm:max-w-md lg:max-w-none"
          aria-hidden="true"
        >
          {HERO_SHELF.map((column, c) => (
            <div key={c} className={`space-y-3 sm:space-y-4 ${c === 1 ? 'pt-10' : ''}`}>
              {column.map((game, r) => (
                <div
                  key={game.title}
                  // Phones get one row of covers so the shelf doesn't fill the screen.
                  // On load the covers rise into place one by one, across the top
                  // row and then the second, like games being set on a shelf.
                  className={`${r > 0 ? 'hidden sm:block ' : ''}relative aspect-[2/3] overflow-hidden rounded-lg bg-ink-900 after:absolute after:inset-0 after:rounded-lg after:ring-1 after:ring-inset after:ring-white/10 animate-rise-in motion-reduce:animate-none`}
                  style={{ animationDelay: `${100 + (r * 3 + c) * 80}ms` }}
                >
                  <Image
                    src={game.image}
                    alt=""
                    fill
                    // Only the row phones see: the rest would compete with it.
                    preload={r === 0}
                    sizes="(max-width: 1024px) 30vw, 140px"
                    className="object-cover"
                  />
                  {game.playing && (
                    <span className="absolute left-2 bottom-2 z-10 inline-flex items-center gap-1.5 rounded-md bg-accent-500 px-2 py-0.5 text-xs font-semibold text-ink-950">
                      Playing
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
