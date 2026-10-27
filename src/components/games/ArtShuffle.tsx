'use client';

import { useEffect, useState } from 'react';
import { GameArt } from './GameArt';

// How long each game's art shows, flicking at a steady pace.
const FLICK_MS = 130;
// Winding down over a set time: from fast to slow, like a wheel coming to a stop.
const FASTEST_MS = 70;
const SLOWEST_MS = 360;

/**
 * Art from your backlog flicking past, filling its (positioned) parent: the
 * frame a picked game is about to land in, while it's picked. With
 * `duration`, it starts fast and slows down over that time (Random); without,
 * it keeps a steady pace until it's replaced (Pick My Game). All the art is
 * loaded up front; only the current one shows.
 */
export function ArtShuffle({
  covers,
  sizes,
  duration,
}: {
  covers: string[];
  sizes: string;
  duration?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (covers.length < 2) return;
    const start = performance.now();
    const delay = () => {
      if (!duration) return FLICK_MS;
      const t = Math.min((performance.now() - start) / duration, 1);
      // Slowing more towards the end.
      return FASTEST_MS + (SLOWEST_MS - FASTEST_MS) * t * t;
    };
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      setIndex((i) => (i + 1) % covers.length);
      timer = setTimeout(next, delay());
    };
    timer = setTimeout(next, delay());
    return () => clearTimeout(timer);
  }, [covers.length, duration]);

  return covers.map((src, i) => (
    <div
      key={src}
      className={`absolute inset-0 ${i === index ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden="true"
    >
      {/* Loaded straight away, not when first shown, or it flicks through blanks. */}
      <GameArt src={src} alt="" sizes={sizes} priority />
    </div>
  ));
}
