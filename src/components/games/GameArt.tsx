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

// How many times a picture that won't load is asked for again. Once more the
// usual way: the app resizes each picture itself and gives up on a source that
// takes too long, which a second ask often gets past (large art from
// SteamGridDB, the first time it's fetched). Then straight from where it's
// kept, full size, with no time limit. A tile that failed used to stay blank
// until the page was reloaded.
const RETRIES = 2;

/**
 * A game's art filling its (positioned) parent. Wide art is cropped to fit;
 * tall box art, for games added by hand without wide artwork, sits whole in
 * the middle over a blurred, enlarged copy of itself, so it fills the frame
 * without losing its top and bottom. Art that fails to load is tried again
 * (see RETRIES) before it's left blank.
 */
export function GameArt(props: GameArtProps) {
  // Keyed by the picture: a new one starts with its tries unused.
  return <Art key={props.src} {...props} />;
}

function Art({ src, alt, sizes, preload, quality, onSettled }: GameArtProps) {
  const [tries, setTries] = useState(0);
  const failed = () => {
    if (tries < RETRIES) setTries(tries + 1);
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
