// The list view's columns, shared by its header and its rows so they line up.
// Columns show from `lg`; below that a row shows the meta row cards use.

export const LIST_ROW = 'flex items-center gap-3 sm:gap-4 px-2';

/** The art: the same 460:215 cover as everywhere, small. */
export const LIST_THUMB = 'w-20 sm:w-24';

// Each heading sits centred over its figures.
export const LIST_COLUMN = {
  status: 'hidden lg:flex w-24 shrink-0 justify-center',
  toBeat: 'hidden lg:block w-24 shrink-0 text-center',
  rating: 'hidden lg:block w-16 shrink-0 text-center',
  played: 'hidden lg:block w-16 shrink-0 text-center',
  myRating: 'hidden lg:flex w-20 shrink-0 justify-center',
};
