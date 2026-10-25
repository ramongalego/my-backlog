import { COVER_ASPECT } from '@/components/games/CoverArt';
import { PAGE_CONTAINER } from '@/components/layout/Page';
import { Skeleton } from '@/components/layout/Skeleton';

// Skeletons for the home dashboard. They use the same sections, padding and
// tile sizes as HomeView and GameCarousel so the page doesn't shift on load.

/** Full home skeleton: the "What are you playing next?" area plus carousels. */
export function LoadingState() {
  return (
    <div className="min-h-screen bg-ink-950 flex flex-col" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="pt-20 sm:pt-24 pb-16 flex-1">
        <section className={`${PAGE_CONTAINER} pb-14`}>
          <div className="max-w-xl">
            <Skeleton className="h-8 sm:h-9 w-72 sm:w-96 max-w-full" />
            <Skeleton className="h-4 w-full mt-3" />
            <Skeleton className="h-4 w-2/3 mt-2" />
            <div className="mt-6 flex items-center gap-2">
              <Skeleton className="h-12 w-40 rounded-lg" />
              <Skeleton className="h-12 w-32 rounded-lg" />
            </div>
          </div>
        </section>
        <CarouselsLoadingState />
      </div>
    </div>
  );
}

/** Mirrors GameCarousel: heading + arrow buttons, then a row of w-64 tiles. */
export function CarouselsLoadingState() {
  return (
    <section className={`${PAGE_CONTAINER} space-y-12`}>
      {[1, 2].map((i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-7 w-56 sm:w-72" />
            <div className="flex gap-2">
              <Skeleton className="w-9 h-9 rounded-full" />
              <Skeleton className="w-9 h-9 rounded-full" />
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden pb-4">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="shrink-0 w-64">
                <Skeleton className={`${COVER_ASPECT} rounded-lg`} />
                <div className="pt-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-1.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Mirrors CurrentlyPlaying while the now-playing game is being resolved. */
export function StatusLoadingState() {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] md:gap-10 md:items-center">
      <Skeleton className={`${COVER_ASPECT} rounded-xl`} />
      <div>
        <Skeleton className="h-8 sm:h-9 w-3/4" />
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
