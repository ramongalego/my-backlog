import type { ReactNode } from 'react';
import { Gamepad2, Loader2 } from 'lucide-react';
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
  artPending = false,
  onArtSettled,
  action,
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
  /**
   * New art is on its way (a pick being previewed): a small spinner over the
   * art that's there, which stays until the new one replaces it.
   */
  artPending?: boolean;
  /** The art has loaded, or couldn't be. */
  onArtSettled?: () => void;
  /** A round control for the top-right corner, left of the dialog's close button. */
  action?: ReactNode;
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
            onSettled={onArtSettled}
          />
        </div>
      ) : (
        <div className="w-full h-full bg-ink-800 flex items-center justify-center">
          <Gamepad2 className="w-10 h-10 text-ink-500" aria-hidden="true" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
      {artPending && (
        <div
          role="status"
          aria-label="Loading the art"
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-950/70 p-2 text-ink-50"
        >
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      )}
      {action && <div className="absolute top-3 right-14 z-10 flex">{action}</div>}
      {children && (
        <div
          className={`absolute top-3 left-4 sm:left-6 flex gap-1 ${action ? 'right-[6.5rem]' : 'right-14'}`}
        >
          {children}
        </div>
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
