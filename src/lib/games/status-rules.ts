import type { GameStatusBody } from '@/lib/validations/games';
import { consoleOf } from './consoles';

export type StatusChange = GameStatusBody;

export interface GameUpdate {
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  dropped_at?: string | null;
  notes?: string | null;
  rating?: number | null;
  last_played_at?: string;
}

/**
 * The columns a status change writes. Shared by the server, which saves it,
 * and the browser, which applies the same change to its cached library so it
 * doesn't download the whole library again after every edit.
 */
export function statusUpdate(
  { status, finishedAt, droppedAt, notes, rating }: Omit<StatusChange, 'gameId'>,
  now = new Date(),
): GameUpdate {
  const update: GameUpdate = { status };
  if (status === 'playing') {
    update.started_at = now.toISOString();
  } else if (status === 'backlog') {
    update.started_at = null;
  } else if (status === 'finished') {
    update.finished_at = finishedAt || null;
    update.notes = notes ?? null;
    update.rating = rating ?? null;
  } else if (status === 'dropped') {
    update.dropped_at = droppedAt || null;
    update.notes = notes ?? null;
    update.rating = rating ?? null;
  } else if (status === 'wont_play' || status === 'hidden') {
    update.started_at = null;
    update.finished_at = null;
    update.dropped_at = null;
    update.notes = null;
    update.rating = null;
  }
  return update;
}

/** A status change from the detail dialogs' fields, where one date input serves finished and dropped. */
export function statusChangeFrom(vars: {
  gameId: number;
  status: string;
  date?: string;
  notes?: string | null;
  rating?: number | null;
}): StatusChange {
  return {
    gameId: vars.gameId,
    status: vars.status as StatusChange['status'],
    finishedAt: vars.status === 'finished' ? vars.date || undefined : undefined,
    droppedAt: vars.status === 'dropped' ? vars.date || undefined : undefined,
    notes: vars.notes,
    rating: vars.rating,
  };
}

/** What starting a game does to whichever other game was playing. */
export const DEMOTED: GameUpdate = { status: 'backlog', started_at: null };

/**
 * The update, plus a last-played date for a game played on a console, which
 * doesn't report one: so it ranks among recently played games (Pick Up Where
 * You Left Off) and shows when you last played it, like Steam games do.
 * Finishing or dropping it dates it to the day you entered (none without
 * one, as for a game finished long ago); stopping it any other way, to now.
 * Steam reports its own games' dates.
 */
export function withLastPlayed(
  game: { status: string | null; source?: string; platform?: string | null },
  update: GameUpdate,
  now = new Date(),
): GameUpdate {
  if (!consoleOf(game)) return update;
  if (update.status === 'finished' || update.status === 'dropped') {
    const endedOn = update.status === 'finished' ? update.finished_at : update.dropped_at;
    return endedOn ? { ...update, last_played_at: endedOn } : update;
  }
  return game.status === 'playing' && update.status !== 'playing'
    ? { ...update, last_played_at: now.toISOString() }
    : update;
}

/** Copies the update's fields that the cached row has, so rows keep their shape. */
function patch<T extends object>(row: T, update: GameUpdate): T {
  const next = { ...row } as Record<string, unknown>;
  for (const [key, value] of Object.entries(update)) if (key in next) next[key] = value;
  return next as T;
}

/**
 * Applies a status change to a cached list of games the way the server
 * applies it to the table: the game gets the new columns, and starting a game
 * moves any other playing game back to the backlog.
 */
export function applyStatusToList<
  T extends { id: number; status: string | null; source?: string; platform?: string | null },
>(games: T[], change: StatusChange, now = new Date()): T[] {
  const update = statusUpdate(change, now);
  return games.map((g) => {
    if (g.id === change.gameId) return patch(g, withLastPlayed(g, update, now));
    if (change.status === 'playing' && g.status === 'playing')
      return patch(g, withLastPlayed(g, DEMOTED, now));
    return g;
  });
}
