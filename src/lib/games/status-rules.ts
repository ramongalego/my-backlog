import type { GameStatusBody } from '@/lib/validations/games';
import { consoleOf } from './consoles';
import type { GameStatus } from './status';

export type StatusChange = GameStatusBody;

interface GameUpdate {
  status: GameStatus;
  started_at?: string | null;
  finished_at?: string | null;
  dropped_at?: string | null;
  notes?: string | null;
  rating?: number | null;
  last_played_at?: string | null;
}

/**
 * Shared by the server, which saves it, and the browser, which patches its
 * cached library with it instead of refetching after every edit.
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

/**
 * One pass, as a bulk change can be hundreds of games. Bulk changes never start
 * a game, so no other game is touched.
 */
export function applyStatusesToList<
  T extends { id: number; status: string | null; source?: string; platform?: string | null },
>(games: T[], changes: StatusChange[], now = new Date()): T[] {
  const byGame = new Map(changes.map((change) => [change.gameId, change]));
  return games.map((g) => {
    const change = byGame.get(g.id);
    return change ? patch(g, withLastPlayed(g, statusUpdate(change, now), now)) : g;
  });
}

/** The detail dialogs have one date field for both finished and dropped. */
export function statusChangeFrom(vars: {
  gameId: number;
  status: GameStatus;
  date?: string;
  notes?: string | null;
  rating?: number | null;
}): StatusChange {
  return {
    gameId: vars.gameId,
    status: vars.status,
    finishedAt: vars.status === 'finished' ? vars.date || undefined : undefined,
    droppedAt: vars.status === 'dropped' ? vars.date || undefined : undefined,
    notes: vars.notes,
    rating: vars.rating,
  };
}

/** What starting a game does to whichever other game was playing. */
export const DEMOTED: GameUpdate = { status: 'backlog', started_at: null };

/** Switching away keeps the start date, for when the game is picked up again. */
export const PAUSED: GameUpdate = { status: 'backlog' };

/**
 * A console reports no last-played date (Steam does), so one is set here for
 * Pick Up Where You Left Off: the date entered on finishing or dropping, else
 * now, unless the game was started under NOT_REALLY_PLAYED_MS ago.
 */
export function withLastPlayed(
  game: {
    status: string | null;
    source?: string;
    platform?: string | null;
    started_at?: string | null;
  },
  update: GameUpdate,
  now = new Date(),
): GameUpdate {
  if (!consoleOf(game)) return update;
  if (update.status === 'finished' || update.status === 'dropped') {
    const endedOn = update.status === 'finished' ? update.finished_at : update.dropped_at;
    return endedOn ? { ...update, last_played_at: endedOn } : update;
  }
  if (game.status !== 'playing' || update.status === 'playing') return update;
  const startedAt = game.started_at ? Date.parse(game.started_at) : NaN;
  if (now.getTime() - startedAt < NOT_REALLY_PLAYED_MS) return update;
  return { ...update, last_played_at: now.toISOString() };
}

/** Stopped this soon (started by mistake, a switch undone), a game wasn't played. */
const NOT_REALLY_PLAYED_MS = 5 * 60 * 1000;

/** Copies the update's fields that the cached row has, so rows keep their shape. */
function patch<T extends object>(row: T, update: GameUpdate): T {
  const next = { ...row } as Record<string, unknown>;
  for (const [key, value] of Object.entries(update)) if (key in next) next[key] = value;
  return next as T;
}

/** Mirrors the server: starting a game moves any other playing game to the backlog. */
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
