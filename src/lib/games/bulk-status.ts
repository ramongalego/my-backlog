import type { BulkStatus, GameStatus } from './status';
import type { StatusChange } from './status-rules';

/** What a bulk change needs to know about a game: where it is, and what moving it could lose. */
export interface BulkGame {
  id: number;
  status: GameStatus;
  finished_at: string | null;
  dropped_at: string | null;
  notes: string | null;
  rating: number | null;
}

/**
 * Whether a game can be ticked in Select mode. Not the game being played or
 * the ones queued: those were lined up on purpose, the queue has an order an
 * Undo couldn't put back, and each is changed from its own dialog.
 */
export function isSelectable(game: { id: number; status: GameStatus }, queuedIds: Set<number>) {
  return game.status !== 'playing' && !queuedIds.has(game.id);
}

/**
 * The changes that move these games to a status. Games already there are left
 * alone. A finished game moved to dropped (or the other way) keeps its rating
 * and notes, as it would in its own dialog; its date isn't carried over, since
 * it was for the other status.
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
 * A game as it was before a bulk change: its status and everything a status
 * change can touch. The server hands these back when it moves games, and Undo
 * sends them to be written back exactly. (Re-applying the old status through
 * the rules wouldn't do: they clear a date, a rating or notes on the way out.)
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

/**
 * How many of these games would lose a rating or notes by moving to a status:
 * Won't Play and Hidden clear them, as they do for one game.
 */
export function reviewsCleared(games: BulkGame[], status: BulkStatus): number {
  if (status !== 'wont_play' && status !== 'hidden') return 0;
  return games.filter((g) => g.status !== status && (g.rating != null || !!g.notes)).length;
}

/** The selection with one game ticked or unticked. */
export function toggleSelected(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (!next.delete(id)) next.add(id);
  return next;
}

/**
 * The selection with every game between two others ticked (shift-click), in
 * the order the page shows them. Games that can't be ticked aren't in `order`.
 */
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
