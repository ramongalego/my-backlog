import { COVER_ASPECT } from '@/components/games/CoverArt';
import { PageSkeleton, PanelSkeleton, Skeleton } from '@/components/layout/Skeleton';
import { panelPadding } from '@/components/ui/Panel';
import {
  ACTIVITY_LIST,
  ACTIVITY_PAGE,
  ACTIVITY_ROW,
  ACTIVITY_THUMB,
  AVATAR_SIZE,
  FAVORITE_GRID,
  FAVORITE_SLOTS,
  FIGURE_CELL,
  FIGURE_STRIP,
  PROFILE_COLUMNS,
  PROFILE_HEADER,
  SIDE_PANEL_HEADING,
  SECTION_HEADING,
} from '@/components/profile/profile-layout';

/** Mirrors ProfileSection's heading row. */
function SectionHeading({ width }: { width: string }) {
  return (
    <div className={SECTION_HEADING}>
      <Skeleton className={`h-6 sm:h-7 ${width}`} />
    </div>
  );
}

/** The rows of an activity list: small art, then a 24px name line over a 20px line. */
function ActivityRows() {
  return (
    <>
      {Array.from({ length: ACTIVITY_PAGE }, (_, i) => (
        <div key={i} className={ACTIVITY_ROW}>
          <Skeleton className={`${ACTIVITY_THUMB} ${COVER_ASPECT} shrink-0 rounded-md`} />
          <div className="min-w-0 flex-1">
            <div className="flex h-6 items-center">
              <Skeleton className="h-5 w-2/5" />
            </div>
            <div className="mt-0.5 flex h-5 items-center">
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * `visitor` is the page others see (/u/<username>): the same header and columns,
 * without what only the player's own page has.
 */
export function ProfilePageSkeleton({ visitor = false }: { visitor?: boolean } = {}) {
  return (
    <PageSkeleton>
      <div className={PROFILE_HEADER}>
        <div className="flex items-center gap-4 sm:gap-5">
          <Skeleton className={`${AVATAR_SIZE} shrink-0 rounded-xl`} />
          <div>
            <Skeleton className="h-8 sm:h-9 w-36" />
            {/* The username. */}
            <Skeleton className="mt-2 h-4 w-20" />
          </div>
          {/* Edit profile, on the player's own: the pencil alone on phones. */}
          {!visitor && <Skeleton className="h-8 w-8 shrink-0 rounded-lg sm:w-28" />}
        </div>
        <div className={FIGURE_STRIP[4]}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={FIGURE_CELL}>
              <Skeleton className="h-7 sm:h-8 w-12" />
              <Skeleton className="mt-1.5 h-3 w-14" />
            </div>
          ))}
        </div>
      </div>

      <div className={PROFILE_COLUMNS}>
        <div className="min-w-0 space-y-10">
          <div>
            <SectionHeading width="w-40" />
            <div className={FAVORITE_GRID}>
              {Array.from({ length: FAVORITE_SLOTS }, (_, i) => (
                <div key={i}>
                  <Skeleton className={`${COVER_ASPECT} rounded-lg`} />
                  {/* A 20px line under the art, as the game's name is. */}
                  <div className="mt-1.5 flex h-5 items-center">
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
            {/* "Drag to reorder". */}
            {!visitor && (
              <div className="mt-3 flex h-5 items-center">
                <Skeleton className="h-4 w-28" />
              </div>
            )}
          </div>
          <div>
            <SectionHeading width="w-36" />
            <div className={ACTIVITY_LIST}>
              <ActivityRows />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {/* Platforms: the count is a guess, and nothing under this column
              moves if it's wrong. */}
          <PanelSkeleton className={panelPadding()}>
            <div className={`${SIDE_PANEL_HEADING} mb-1.5`}>
              <Skeleton className="h-5 w-20" />
            </div>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex h-8 items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </PanelSkeleton>
          {/* Ratings: the bars, then the two ends of the scale. */}
          <PanelSkeleton className={panelPadding()}>
            <div className={`${SIDE_PANEL_HEADING} mb-4`}>
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-14 w-full" />
            <div className="mt-1.5 h-4" />
          </PanelSkeleton>
        </div>
      </div>
    </PageSkeleton>
  );
}
