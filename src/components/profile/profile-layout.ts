// The Profile page's measurements, shared by the page and its loading
// skeleton so the two can't drift apart. A plain module (no 'use client'):
// the skeleton is drawn on the server, which can't read a client file's
// constants.

import { MAX_FAVORITES } from '@/lib/account/favorites';

/** The header: who it is, then the figures, side by side from `lg`. */
export const PROFILE_HEADER =
  'mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10';

/** The avatar's box: 64px on phones, 80px from `sm`. */
export const AVATAR_SIZE = 'h-16 w-16 sm:h-20 sm:w-20';

/** The strip of figures, and one figure in it. */
export const FIGURE_STRIP = 'grid grid-cols-4 lg:flex lg:shrink-0';
export const FIGURE_CELL = 'px-3 first:pl-0 last:pr-0 max-[359px]:px-2 sm:px-5 lg:px-6';

/** The two columns under the header: what the profile shows, then the account. */
export const PROFILE_COLUMNS = 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12';

/** How many favorites the row holds (as many as can be picked), and its grid. */
export const FAVORITE_SLOTS = MAX_FAVORITES;
export const FAVORITE_GRID = 'grid grid-cols-2 sm:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-4';

/** A section's heading row: its title, with room for an action beside it. */
export const SECTION_HEADING = 'mb-4 flex min-h-8 items-center justify-between gap-4';

/** The activity list and one row of it. */
export const ACTIVITY_LIST = 'divide-y divide-ink-800/70 border-y border-ink-800/70';
export const ACTIVITY_ROW = 'flex items-center gap-3 sm:gap-4 py-2.5';
