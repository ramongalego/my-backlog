import { COVER_ASPECT } from '@/components/games/CoverArt';
import { PAGE_CONTAINER } from '@/components/layout/Page';
import { Skeleton } from '@/components/layout/Skeleton';
import {
  CAROUSEL_CARD_WIDTH,
  CAROUSEL_FADE_CLASS,
  CAROUSEL_FADE_STYLE,
  CAROUSEL_PER_PAGE,
} from '@/components/games/carousel-layout';

// Skeletons for the home dashboard. They use the same sections, padding and
// tile sizes as HomeView and GameCarousel so the page doesn't shift on load.

/** Which of Home's bands to draw, and what goes around it. */
export interface HomeShape {
  /** A game being played, picking one, or building a backlog first. */
  band: 'playing' | 'picker' | 'building';
  /** Playing: whether a game is queued after it (the Up next strip's thumbnail). */
  queued: boolean;
  /** Not on Steam: the band's line about connecting it. */
  steamConnected: boolean;
  /** How many carousel rows to hold space for. */
  carouselRows: number;
}

/**
 * The usual case for a returning player, so it's the one that doesn't jump
 * when nothing is known yet: a game being played, one queued after it.
 */
export const PLAYING_SHAPE: HomeShape = {
  band: 'playing',
  queued: true,
  steamConnected: true,
  carouselRows: 2,
};

/**
 * Full home skeleton: the band in the shape Home will have (see HomeLoading,
 * which works it out from what's already known), the Up next strip under a
 * game being played, and the carousels.
 */
export function LoadingState({ shape = PLAYING_SHAPE }: { shape?: HomeShape }) {
  return (
    <div className="min-h-screen bg-ink-950 flex flex-col" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="pt-14 sm:pt-16 pb-16 flex-1">
        <section className="bg-ink-900">
          <div className={`${PAGE_CONTAINER} py-8 sm:py-12`}>
            {shape.band === 'playing' ? (
              <StatusLoadingState />
            ) : (
              <TextBandLoadingState
                progress={shape.band === 'building'}
                steamNote={!shape.steamConnected}
              />
            )}
          </div>
        </section>
        {shape.band === 'playing' && <UpNextLoadingState queued={shape.queued} />}
        {shape.carouselRows > 0 && <CarouselsLoadingState rows={shape.carouselRows} />}
      </div>
    </div>
  );
}

/**
 * Mirrors the bands without a game: picking one ("What are you playing
 * next?") or building a backlog first, which adds the three-step bar.
 */
function TextBandLoadingState({ progress, steamNote }: { progress: boolean; steamNote: boolean }) {
  return (
    <div className="max-w-xl">
      <Skeleton className="h-8 sm:h-9 w-3/4" />
      {/* Two lines of text-base. */}
      <div className="mt-2 space-y-2 py-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      {progress && (
        <div className="mt-5">
          <Skeleton className="h-1.5 max-w-xs rounded-full" />
          <Skeleton className="h-4 w-24 mt-2.5" />
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-12 w-40 rounded-lg" />
        <Skeleton className="h-12 w-36 rounded-lg" />
      </div>
      {steamNote && <Skeleton className="h-4 w-80 max-w-full mt-5" />}
    </div>
  );
}

/**
 * Mirrors GameCarousel: the title, then a row of cards at the carousel's own
 * widths (a page plus the peeking card under the fade). No arrows, since the
 * carousel only shows them on hover.
 */
export function CarouselsLoadingState({ rows = 2 }: { rows?: number }) {
  return (
    <section className={`${PAGE_CONTAINER} mt-12 sm:mt-14 space-y-16`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <Skeleton className="mb-4 h-7 w-56 sm:w-72" />
          <div className={`relative ${CAROUSEL_PER_PAGE}`}>
            <div className="flex gap-4 overflow-hidden max-sm:-mx-4 max-sm:px-4">
              {/* Enough for the widest row: five cards and the peeking sixth. */}
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <div key={j} className="min-w-0" style={{ flex: `0 0 ${CAROUSEL_CARD_WIDTH}` }}>
                  <Skeleton className={`${COVER_ASPECT} rounded-lg`} />
                  <div className="pt-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </div>
                </div>
              ))}
            </div>
            <div aria-hidden="true" className={CAROUSEL_FADE_CLASS} style={CAROUSEL_FADE_STYLE} />
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Mirrors the Up next strip under the band: the next queued game (or the line
 * saying the queue is empty) and the Pick button.
 */
function UpNextLoadingState({ queued }: { queued: boolean }) {
  return (
    <div
      className={`${PAGE_CONTAINER} mt-6 sm:mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4`}
    >
      {queued ? (
        <div className="flex items-center gap-3 sm:gap-4">
          <Skeleton className={`${COVER_ASPECT} w-20 sm:w-28 rounded-md`} />
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32 mt-1.5" />
          </div>
        </div>
      ) : (
        <Skeleton className="h-4 w-96 max-w-full" />
      )}
      <Skeleton className="h-10 w-44 rounded-lg" />
    </div>
  );
}

/** Mirrors CurrentlyPlaying while the now-playing game is being resolved. */
export function StatusLoadingState() {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] lg:grid-cols-[minmax(0,32rem)_1fr] md:gap-10 lg:gap-12 md:items-center">
      <Skeleton className={`${COVER_ASPECT} rounded-xl`} />
      <div>
        <Skeleton className="h-8 sm:h-9 lg:h-10 w-3/4" />
        <Skeleton className="h-4 w-24 mt-3" />
        <Skeleton className="h-4 w-full max-w-sm mt-6" />
        <Skeleton className="h-1.5 w-full max-w-sm mt-3 rounded-full" />
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
