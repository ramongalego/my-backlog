/**
 * The one source for the type, request validation and dialog options. The
 * database holds the column to the same values (games_status_check).
 */
export const GAME_STATUSES = [
  'backlog',
  'playing',
  'finished',
  'dropped',
  'wont_play',
  'hidden',
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

/** What Home's and the Queue's Finish and Drop offer. */
export const COMPLETION_STATUSES = ['finished', 'dropped'] as const;

export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

/**
 * Queue isn't a status (a queued game is a backlog game with a place in the
 * queue). Won't Play and Hidden are only for games already in the library.
 */
export const ADD_STATUSES = ['backlog', 'queue', 'playing', 'finished', 'dropped'] as const;

export type AddStatus = (typeof ADD_STATUSES)[number];

/** Not Playing: only one game plays at a time. */
export const BULK_STATUSES = ['backlog', 'finished', 'dropped', 'wont_play', 'hidden'] as const;

export type BulkStatus = (typeof BULK_STATUSES)[number];

export const MAX_BULK_CHANGES = 2000;
