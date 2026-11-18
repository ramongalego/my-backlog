import type { BulkStatus, GameStatus } from './status';
import type { StatusChange } from './status-rules';

export interface BulkGame {
  id: number;
  status: GameStatus;
  finished_at: string | null;
  dropped_at: string | null;
  notes: string | null;
  rating: number | null;
}

/**
 * Not the game being played or queued ones: they were lined up on purpose, Undo
 * couldn't put the queue's order back, and each is changed from its own dialog.
 */
export function isSelectable(game: { id: number; status: GameStatus }, queuedIds: Set<number>) {
  return game.status !== 'playing' && !queuedIds.has(game.id);
}

/**
 * A finished game moved to dropped (or back) keeps its rating and notes, as in
 * its own dialog, but not its date: that was for the other status.
 */
export function bulkChanges(games: BulkGame[], status: BulkStatus): StatusChange[] {
  return games
    .filter((game) => game.status !== status)
    .map((game) =>
      status === 'finished' || status === 'dropped'
        ? { gameId: game.id, status, notes: game.notes, rating: game.rating }
        : { gameId: game.id, status },
    );
}

/**
 * A game before a bulk change, which Undo writes back exactly: re-applying the
 * old status through the rules would clear a date, rating or notes.
 */
export interface GameRestore {
  id: number;
  status: BulkStatus;
  started_at: string | null;
  finished_at: string | null;
  dropped_at: string | null;
  notes: string | null;
  rating: number | null;
  last_played_at: string | null;
}

/** Won't Play and Hidden clear a rating and notes, as they do for one game. */
export function reviewsCleared(games: BulkGame[], status: BulkStatus): number {
  if (status !== 'wont_play' && status !== 'hidden') return 0;
  return games.filter((g) => g.status !== status && (g.rating != null || !!g.notes)).length;
}

export function toggleSelected(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** Shift-click. `order` is the page's order, without games that can't be ticked. */
export function selectRange(
  order: number[],
  selected: ReadonlySet<number>,
  from: number,
  to: number,
): Set<number> {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  const next = new Set(selected);
  if (a < 0 || b < 0) return next.add(to);
  for (const id of order.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(id);
  return next;
}
