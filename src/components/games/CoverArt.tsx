import type { ReactNode } from 'react';
import { GameArt } from './GameArt';
import { Gamepad2 } from 'lucide-react';
import { ArtTags } from './ArtTags';

/** Steam header capsules are 460×215; every game image in the app uses this ratio. */
export const COVER_ASPECT = 'aspect-[460/215]';

const RADIUS = {
  md: 'rounded-md after:rounded-md',
  lg: 'rounded-lg after:rounded-lg',
  xl: 'rounded-xl after:rounded-xl',
};

/**
 * Art that can be pressed brightens under the pointer, and that is all: no
 * icon drawn over it, nothing darkened, and its edge left as it is. Only the
 * picture brightens (not the badges on it, nor the blurred copy behind box
 * art, which is `aria-hidden`); art with no picture goes a tone lighter.
 */
const PRESSABLE =
  'transition-colors group-hover:bg-ink-800 [&>img:not([aria-hidden])]:transition-[filter] [&>img:not([aria-hidden])]:duration-200 group-hover:[&>img:not([aria-hidden])]:brightness-115';

/**
 * A game's header image at the shared ratio, with a hairline inner edge so
 * dark art doesn't melt into the page. Size it with a width class; height
 * follows from the ratio. `children` render on top (badges);
 * `platform`, for games added by hand, puts the console in the bottom-left, and
 * `releaseDate` an "Out Nov 5" tag beside it for a game that isn't out yet.
 * Where the art can be pressed (it opens its game, or picks it), put the
 * `group` class on what is pressed and set `interactive`: the art brightens
 * while the pointer is on it (see PRESSABLE).
 */
export function CoverArt({
  src,
  alt,
  sizes,
  preload,
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
  preload?: boolean;
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
        interactive ? PRESSABLE : ''
      } ${className}`}
    >
      {src ? (
        <GameArt src={src} alt={alt} sizes={sizes} preload={preload} quality={quality} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Gamepad2 className="w-1/5 max-w-8 h-auto text-ink-600" aria-hidden="true" />
        </div>
      )}
      {children}
      {/* A space, so the words of one tag don't run into the next when the
          art's text is read as a whole (it draws nothing). */}{' '}
      <ArtTags platform={platform} releaseDate={releaseDate} />
    </div>
  );
}

/** Small cover for list rows (queue, diary, stats): 64px wide on phones, 112px from `sm`. */
const THUMB_WIDTH = 'w-16 sm:w-28';

export function CoverThumb({
  src,
  alt,
  className = THUMB_WIDTH,
  interactive,
  children,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** As CoverArt's: the art can be pressed, and brightens under the pointer. */
  interactive?: boolean;
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
      interactive={interactive}
      className={`shrink-0 ${className}`}
    >
      {children}
    </CoverArt>
  );
}
