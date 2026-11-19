'use client';

import { COVER_ASPECT } from '@/components/games/CoverArt';
import { PAGE_CONTAINER } from '@/components/layout/Page';
import { Skeleton } from '@/components/layout/Skeleton';
import {
  CAROUSEL_CARD_WIDTH,
  CAROUSEL_FADE_CLASS,
  CAROUSEL_FADE_STYLE,
  CAROUSEL_PER_PAGE,
} from '@/components/home/carousel-layout';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { MIN_GAMES_TO_PICK, type LibraryMeta } from '@/lib/data/loaders';
import type { GameWithImage, QueueItem } from '@/types/games';

// Same sections, padding and tile sizes as HomeView and GameCarousel, so the
// page doesn't shift on load.

interface HomeShape {
  band: 'playing' | 'picker' | 'building';
  /** Without a game being played, the Up next strip only shows when one is queued. */
  queued: boolean;
  /** False draws the band's line about connecting Steam. */
  steamConnected: boolean;
  carouselRows: number;
}

/** The usual case for a returning player, so the one that doesn't jump when nothing is cached. */
export const PLAYING_SHAPE: HomeShape = {
  band: 'playing',
  queued: true,
  steamConnected: true,
  carouselRows: 2,
};

function LoadingState({ shape = PLAYING_SHAPE }: { shape?: HomeShape }) {
  return (
    <div className="flex-1 bg-ink-950 flex flex-col" role="status" aria-busy="true">
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
        {(shape.band === 'playing' || shape.queued) && <UpNextLoadingState queued={shape.queued} />}
        {shape.carouselRows > 0 && <CarouselsLoadingState rows={shape.carouselRows} />}
      </div>
    </div>
  );
}

/** Mirrors PickNext and BuildBacklog, the bands without a game. */
function TextBandLoadingState({ progress, steamNote }: { progress: boolean; steamNote: boolean }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] lg:grid-cols-[minmax(0,32rem)_1fr] md:gap-10 lg:gap-12 md:items-center">
      {progress ? (
        <div className="grid grid-cols-[2fr_1fr] grid-rows-2 gap-2">
          <Skeleton className={`row-span-2 ${COVER_ASPECT} rounded-xl`} />
          <Skeleton className="rounded-xl" />
          <Skeleton className="rounded-xl" />
        </div>
      ) : (
        <Skeleton className={`${COVER_ASPECT} rounded-xl`} />
      )}
      <div className="max-w-xl">
        <Skeleton className="h-8 sm:h-9 lg:h-10 w-3/4" />
        <div className="mt-3 space-y-2 py-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        {progress && <Skeleton className="h-4 w-24 mt-2.5" />}
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-12 w-40 rounded-lg" />
          <Skeleton className="h-12 w-36 rounded-lg" />
        </div>
        {steamNote && <Skeleton className="h-4 w-80 max-w-full mt-5" />}
      </div>
    </div>
  );
}

/** Mirrors GameCarousel. No arrows, since the carousel only shows them on hover. */
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

/** Mirrors CurrentlyPlaying. */
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

/** The first match is enough: a cache only ever holds one signed-in user. */
function cached<T>(queryClient: QueryClient, queryKey: readonly unknown[]): T | undefined {
  return queryClient
    .getQueriesData<T>({ queryKey })
    .map(([, data]) => data)
    .find((data) => data !== undefined);
}

/** Works the shape out from what earlier pages this visit already cached. */
export function homeShape(queryClient: QueryClient): HomeShape {
  const playing = cached<GameWithImage | null>(queryClient, [...queryKeys.games.all, 'playing']);
  if (playing === undefined) return PLAYING_SHAPE;

  const session = queryClient.getQueryData<{ profile?: { steam_id?: string | null } | null }>(
    queryKeys.auth.session(),
  );
  const steamConnected = !!session?.profile?.steam_id;

  const queue = cached<QueueItem[]>(queryClient, [...queryKeys.queue.all, 'list']);
  if (playing) {
    return { ...PLAYING_SHAPE, queued: queue ? queue.length > 0 : true, steamConnected };
  }
  const queued = !!queue?.length;

  const meta = cached<LibraryMeta>(queryClient, [...queryKeys.library.all, 'meta']);
  if (meta && meta.backlogCount < MIN_GAMES_TO_PICK) {
    // Recently Added shows from the first game; nothing else does yet.
    return {
      band: 'building',
      queued,
      steamConnected,
      carouselRows: meta.gameCount ? 1 : 0,
    };
  }
  return { band: 'picker', queued, steamConnected, carouselRows: 2 };
}

export function HomeLoading() {
  const queryClient = useQueryClient();
  return <LoadingState shape={homeShape(queryClient)} />;
}
