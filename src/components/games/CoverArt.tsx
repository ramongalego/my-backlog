import type { ReactNode } from 'react';
import { GameArt } from './GameArt';
import { Gamepad2, Pencil } from 'lucide-react';
import { ConsoleBadge } from './ConsoleBadge';
import { ReleaseBadge } from './ReleaseBadge';
import { upcomingRelease } from '@/lib/games/release-date';

/** Steam header capsules are 460×215; every game image in the app uses this ratio. */
export const COVER_ASPECT = 'aspect-[460/215]';

const RADIUS = {
  md: 'rounded-md after:rounded-md',
  lg: 'rounded-lg after:rounded-lg',
  xl: 'rounded-xl after:rounded-xl',
};

/**
 * A game's header image at the shared ratio, with a hairline inner edge so
 * dark art doesn't melt into the page. Size it with a width class; height
 * follows from the ratio. `children` render on top (badges, hover overlays);
 * `platform`, for games added by hand, puts the console in the bottom-left, and
 * `releaseDate` an "Out Nov 5" tag beside it for a game that isn't out yet.
 * Inside a `group`, set `interactive` to brighten the edge on hover.
 */
export function CoverArt({
  src,
  alt,
  sizes,
  priority,
  quality,
  rounded = 'lg',
  interactive = false,
  className = '',
  platform,
  releaseDate,
  children,
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  quality?: number;
  rounded?: keyof typeof RADIUS;
  interactive?: boolean;
  className?: string;
  /** The console a game added by hand is on (consoleOf). */
  platform?: string | null;
  /** The game's release date: an unreleased game gets "Out Nov 5" beside the console. */
  releaseDate?: string | null;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative ${COVER_ASPECT} overflow-hidden bg-ink-900 ${RADIUS[rounded]} after:pointer-events-none after:absolute after:inset-0 after:ring-1 after:ring-inset after:ring-white/8 ${
        interactive ? 'after:transition-colors group-hover:after:ring-white/20' : ''
      } ${className}`}
    >
      {src ? (
        <GameArt src={src} alt={alt} sizes={sizes} priority={priority} quality={quality} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Gamepad2 className="w-1/5 max-w-8 h-auto text-ink-600" aria-hidden="true" />
        </div>
      )}
      {children}
      {(platform || upcomingRelease(releaseDate)) && (
        <div className="absolute bottom-2 left-2 right-2 flex gap-1">
          {platform && <ConsoleBadge platform={platform} />}
          <ReleaseBadge releaseDate={releaseDate} />
        </div>
      )}
    </div>
  );
}

/**
 * Darkens the art and shows a pencil on hover. Place inside CoverArt when the
 * art opens the game's details; needs a `group` ancestor.
 */
export function CoverEditHint() {
  return (
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
      <Pencil
        className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
        aria-hidden="true"
      />
    </div>
  );
}

/** Small cover for list rows (queue, diary, stats): 64px wide on phones, 112px from `sm`. */
export const THUMB_WIDTH = 'w-16 sm:w-28';

export function CoverThumb({
  src,
  alt,
  className = THUMB_WIDTH,
  children,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <CoverArt
      src={src}
      alt={alt}
      rounded="md"
      // Requested at twice the display width: a 1:1 downscale of Steam art looks
      // soft, even on 1x screens.
      sizes="(max-width: 640px) 128px, 224px"
      quality={90}
      className={`shrink-0 ${className}`}
    >
      {children}
    </CoverArt>
  );
}
