// Shared by the Profile page and its skeleton so the two can't drift apart. No
// 'use client': the server-drawn skeleton can't read a client file's constants.

import { MAX_FAVORITES } from '@/lib/account/favorites';

export const PROFILE_HEADER =
  'mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10';

export const AVATAR_SIZE = 'h-16 w-16 sm:h-20 sm:w-20';

/** Under the name: the username. */
export const PROFILE_BYLINE = 'mt-1 min-h-5 truncate text-sm text-ink-400';
/**
 * By how many figures it holds: the fifth, the average rating, comes with
 * enough rated games. Five equal columns on a phone are narrower than
 * "Finished" and "This year", so there each is as wide as what it holds and
 * they share what's left over.
 */
export const FIGURE_STRIP = {
  4: 'grid grid-cols-4 lg:flex lg:shrink-0',
  5: 'grid grid-cols-[repeat(5,auto)] lg:flex lg:shrink-0',
};
export const FIGURE_CELL = 'px-3 first:pl-0 last:pr-0 max-[359px]:px-2 sm:px-5 lg:px-6';

/** A side panel's heading (Platforms, Ratings): its name and count over a hairline. */
export const SIDE_PANEL_HEADING =
  'flex items-baseline justify-between gap-3 border-b border-ink-800 pb-1.5';

/** The two columns under the header: what the profile shows, then the account. */
export const PROFILE_COLUMNS = 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12';

export const FAVORITE_SLOTS = MAX_FAVORITES;
export const FAVORITE_GRID = 'grid grid-cols-2 sm:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-4';
/** How wide a favorite's art is drawn, for the browser to pick a file by. */
export const FAVORITE_ART_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px';

export const SECTION_HEADING = 'mb-4 flex min-h-8 items-center justify-between gap-4';

/** How many activity rows show at first, and how many more Show more adds each time. */
export const ACTIVITY_PAGE = 6;

export const ACTIVITY_LIST = 'divide-y divide-ink-800/70 border-y border-ink-800/70';
export const ACTIVITY_ROW = 'flex items-center gap-3 sm:gap-4 py-2.5';
