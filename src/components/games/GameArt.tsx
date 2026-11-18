'use client';

import { useState } from 'react';
import Image from 'next/image';
import { isBoxArt } from '@/lib/igdb/images';

interface GameArtProps {
  src: string;
  alt: string;
  sizes: string;
  preload?: boolean;
  quality?: number;
  /** The art has loaded, or couldn't be: whoever is waiting on it can stop. */
  onSettled?: () => void;
}

// Once more through the app's resizer, which gives up on slow sources (large
// SteamGridDB art fetched for the first time), then straight from the source.
const RETRIES = 2;

/**
 * Fills its positioned parent. Tall box art sits whole over a blurred copy of
 * itself, so it fills the frame without losing its top and bottom.
 */
export function GameArt({ src, alt, sizes, preload, quality, onSettled }: GameArtProps) {
  // Tries are counted per `src`, not reset by remounting: the old picture stays
  // until the new one loads (the art picker's preview counts on it).
  const [failures, setFailures] = useState({ src, tries: 0 });
  const tries = failures.src === src ? failures.tries : 0;
  const failed = () => {
    if (tries < RETRIES) setFailures({ src, tries: tries + 1 });
    else onSettled?.();
  };
  const shared = {
    src,
    fill: true,
    sizes,
    preload,
    quality,
    // The last try skips the app's resizing: the browser fetches the file itself.
    unoptimized: tries === RETRIES || undefined,
    draggable: false,
  };

  if (!isBoxArt(src)) {
    return (
      <Image
        // A new element each try: an image that failed doesn't load again in place.
        key={tries}
        {...shared}
        alt={alt}
        className="object-cover"
        onLoad={onSettled}
        onError={failed}
      />
    );
  }
  return (
    <>
      {/* The same size (and try) as the art on top, so one download serves
          both and the blur doesn't arrive after the art. */}
      <Image
        key={`blur-${tries}`}
        {...shared}
        alt=""
        aria-hidden="true"
        className="object-cover scale-125 blur-xl brightness-75 saturate-150"
      />
      <Image
        key={tries}
        {...shared}
        alt={alt}
        className="object-contain"
        onLoad={onSettled}
        onError={failed}
      />
    </>
  );
}
