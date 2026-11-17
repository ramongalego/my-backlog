// How to read a game's history (the game_events table, written by triggers
// on games: see supabase/schema.sql). The history records what changed; some
// of what it means takes a rule to read, and the rule lives here, once.

/** One event of a game's history, as the table holds it. */
export interface HistoryEvent {
  /**
   * `added`: the game arrived, and `changes` is what it started with (every
   * "before" null). `status`: its status moved, with any dates and rating
   * saved with it. `edit`: a date, the rating or the platform changed by
   * itself. `playtime`: only the hours changed.
   */
  kind: 'added' | 'status' | 'edit' | 'playtime';
  /** Each value that changed, as [before, after]. Hours are in minutes. */
  changes: Record<string, [unknown, unknown]>;
  /** When it was logged, which can be days after it happened. */
  created_at: string;
}

/** Time played in one go, as far as the history can tell. */
interface Play {
  minutes: number;
  /**
   * When: the game's last-played date where the event carries one (Steam
   * reports it; a console game is dated when its hours are logged), or else
   * when the event was logged.
   */
  at: string;
}

/**
 * The time played on one game, from its events in order.
 *
 * A game's hours are a running total for the platform it is on, so the time
 * played is that total going up. Not every change to it is play:
 * - the hours a game arrives with were played before it was here;
 * - moving a game to another platform replaces its hours (a Steam game moved
 *   to a console takes the hours entered for the console, and Steam's come
 *   back when it is moved back), so the first total after a move is where
 *   counting starts again;
 * - a total that goes down is a correction.
 *
 * Hours can change in an event of any kind: a status change saved in the same
 * sitting as a Steam refresh carries both.
 */
export function playsOf(events: readonly HistoryEvent[]): Play[] {
  const plays: Play[] = [];
  // Moved to another platform, with the hours there not yet known.
  let startingAgain = false;
  for (const event of events) {
    const hours = event.changes.playtime_forever;
    if (event.kind === 'added') {
      startingAgain = false;
      continue;
    }
    if ('platform' in event.changes) {
      // Hours saved with the move are the new platform's starting total.
      startingAgain = !hours;
      continue;
    }
    if (!hours) continue;
    if (startingAgain) {
      startingAgain = false;
      continue;
    }
    const [before, after] = hours;
    if (typeof before !== 'number' || typeof after !== 'number' || after <= before) continue;
    const playedOn = event.changes.last_played_at?.[1];
    plays.push({
      minutes: after - before,
      at: typeof playedOn === 'string' ? playedOn : event.created_at,
    });
  }
  return plays;
}
