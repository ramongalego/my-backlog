import type { ReactNode } from 'react';
import { Gamepad2 } from 'lucide-react';
import { GameArt } from '@/components/games/GameArt';
import { COVER_ASPECT } from '@/components/games/CoverArt';

/**
 * A game's art across the top of a dialog (or a card), whole at the cover
 * ratio so logos aren't cut off, with its name over a gradient at the bottom.
 * `bleed` runs it to the dialog's edges, past the Modal's padding.
 */
export function ArtHeader({
  src,
  title,
  subtitle,
  as: Heading = 'h2',
  bleed = true,
  loading = false,
  preload = false,
  artClassName = '',
  children,
}: {
  src: string | null | undefined;
  title: string;
  /** Under the name, e.g. the genres. */
  subtitle?: ReactNode;
  as?: 'h1' | 'h2';
  bleed?: boolean;
  /** The art is still being found: a pulse in its place. */
  loading?: boolean;
  preload?: boolean;
  /** On the art itself, e.g. the reveal when a pick lands. */
  artClassName?: string;
  /** Badges for the top-left corner (the close button has the top-right). */
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative ${COVER_ASPECT} overflow-hidden ${
        bleed ? '-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 rounded-t-2xl' : ''
      }`}
    >
      {loading ? (
        <div className="w-full h-full bg-ink-800 animate-pulse" data-testid="header-loading" />
      ) : src ? (
        <div className={`absolute inset-0 ${artClassName}`}>
          <GameArt
            src={src}
            alt=""
            sizes="(max-width: 640px) 100vw, 544px"
            preload={preload || undefined}
          />
        </div>
      ) : (
        <div className="w-full h-full bg-ink-800 flex items-center justify-center">
          <Gamepad2 className="w-10 h-10 text-ink-500" aria-hidden="true" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
      {children && (
        <div className="absolute top-3 left-4 sm:left-6 right-14 flex gap-1">{children}</div>
      )}
      <div className="absolute bottom-3 left-4 right-4 sm:left-6 sm:right-6">
        <Heading className="text-2xl font-semibold tracking-tight text-ink-50 leading-tight line-clamp-2">
          {title}
        </Heading>
        {subtitle && <p className="mt-1 text-sm text-ink-300">{subtitle}</p>}
      </div>
    </div>
  );
}
