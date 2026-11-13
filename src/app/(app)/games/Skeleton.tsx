import { COVER_ASPECT } from '@/components/games/CoverArt';
import { LIST_COLUMN, LIST_ROW, LIST_THUMB } from '@/components/games/game-list-columns';
import type { GamesView } from '@/lib/games/games-view';
import {
  EmptyStateSkeleton,
  PageHeaderSkeleton,
  PageSkeleton,
  Skeleton,
} from '@/components/layout/Skeleton';

const FILTER_PILL_WIDTHS = ['w-14', 'w-24', 'w-24', 'w-24', 'w-28', 'w-20'];

/** Mirrors GameCard: cover art, then the title and meta row. */
function GameGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className={`${COVER_ASPECT} rounded-lg`} />
          <div className="pt-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-1.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors GameList: the column header, then rows of small art, name and details. */
function GameListSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div>
      <div className={`hidden lg:flex ${LIST_ROW} h-9 border-b border-ink-800`}>
        <span className={`${LIST_THUMB} shrink-0`} />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="mt-1 lg:mt-2">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={`${LIST_ROW} py-2`}>
            <Skeleton className={`${LIST_THUMB} ${COVER_ASPECT} shrink-0 rounded-md`} />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-4 w-1/3 mt-1 lg:hidden" />
            </div>
            <Skeleton className={`${LIST_COLUMN.toBeat} h-4`} />
            <Skeleton className={`${LIST_COLUMN.rating} h-4`} />
            <Skeleton className={`${LIST_COLUMN.played} h-4`} />
            <span className={LIST_COLUMN.myRating} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * `empty`: the library is known to be empty, so no grid of cards to hold.
 * `view`: the grid or the list, as the page will be drawn.
 */
export function GamesPageSkeleton({
  empty = false,
  view = 'grid',
}: {
  empty?: boolean;
  view?: GamesView;
}) {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton
        titleWidth="w-36"
        descriptionWidth="w-40"
        actions={
          <div className="flex gap-1.5 overflow-hidden">
            {FILTER_PILL_WIDTHS.map((width, i) => (
              <Skeleton key={i} className={`h-8 shrink-0 rounded-lg ${width}`} />
            ))}
          </div>
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Skeleton className="h-10 w-full sm:w-80 rounded-lg" />
          {/* Select, the view switch and Sort: three controls of one height. */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 sm:w-[92px] rounded-lg" />
            <Skeleton className="h-10 w-[78px] rounded-lg" />
            <Skeleton className="ml-auto sm:ml-0 h-10 w-[116px] rounded-lg" />
          </div>
        </div>
      </PageHeaderSkeleton>
      {empty ? (
        <EmptyStateSkeleton />
      ) : view === 'list' ? (
        <GameListSkeleton />
      ) : (
        <GameGridSkeleton />
      )}
    </PageSkeleton>
  );
}
