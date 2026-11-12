/**
 * The statuses a game can have. This list is the one source: the type, the
 * request validation and the dialog's options all come from it, and the
 * database holds the column to the same six values (games_status_check).
 * What each one looks like is in status-style.ts.
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

/**
 * Where a new game can go when it's added. Queue isn't a status of its own (a
 * queued game is a backlog game with a place in the queue); Won't Play and
 * Hidden are for games already in the library.
 */
export const ADD_STATUSES = ['backlog', 'queue', 'playing', 'finished', 'dropped'] as const;

export type AddStatus = (typeof ADD_STATUSES)[number];
