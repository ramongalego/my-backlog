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

/** How many activity rows show at first, and how many more Show more adds each time. */
export const ACTIVITY_PAGE = 6;

/**
 * The activity list: its days, each with its date beside its rows (above
 * them on phones), and one row.
 */
export const ACTIVITY_LIST = 'divide-y divide-ink-800/70 border-y border-ink-800/70';
export const ACTIVITY_DAY = 'sm:flex sm:gap-4';
// Level with the first row's text: the row's padding, and its text centered on its art.
// Wide enough for a month with its year ("Aug 2025") on one line.
export const ACTIVITY_DATE = 'pt-3 tabular-nums sm:w-16 sm:shrink-0 sm:pt-[13px]';
/**
 * The date as a stamp: the day over its month from `sm`, side by side on
 * phones. From `sm` it stays in view under the header while its day's rows
 * scroll past, so a long day never leaves the column beside it empty.
 */
export const ACTIVITY_STAMP =
  'flex items-baseline gap-1.5 whitespace-nowrap sm:sticky sm:top-20 sm:flex-col sm:items-center sm:gap-0.5';
export const ACTIVITY_ROWS = 'min-w-0 flex-1 divide-y divide-ink-800/40';
export const ACTIVITY_ROW = 'flex items-center gap-3 sm:gap-4 py-2.5';
