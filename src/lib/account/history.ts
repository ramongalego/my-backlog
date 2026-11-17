// How to read a game's history (the game_events table, written by triggers
// on games: see supabase/schema.sql). The history records what changed; some
// of what it means takes a rule to read, and the rule lives here, once.

/** One event of a game's history, as the table holds it. */
export interface HistoryEvent {
  /**
   * `added`: the game arrived, and `changes` is what it started with (every
   * "before" null). `status`: its status moved, with any dates and rating
   * saved with it. `edit`: a date, the rating or the platform changed by
   * itself. `queue`: it went on the queue or came off it (`queued`).
   * `favorite`: it became one of the favorites or stopped being one.
   * `note`: it got a note or lost it (`noted`: never the note's words).
   * `playtime`: only the hours changed. An event of one kind can carry the
   * others' values too, when they changed in the same sitting.
   *
   * To count finishes, count a finish date being set (`finished_at` going to
   * a new day), not the status becoming "finished": a game moved off Finished
   * by mistake and back keeps its date, and that is the same finish.
   */
  kind: 'added' | 'status' | 'edit' | 'queue' | 'favorite' | 'note' | 'playtime';
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
 *   to a console takes the hours entered for the console, and Steam's are
 *   saved with the move when it is moved back), so hours that change in the
 *   same event as the platform are the new platform's total;
 * - a total that goes down is a correction, and one that comes from or goes
 *   to no value says nothing.
 *
 * Hours can change in an event of any kind: a status change saved in the same
 * sitting as a Steam refresh carries both. Hours logged after a move that
 * kept them (one console to another) are play like any other.
 *
 * Two things this can't see. Steam counts tools and soundtracks as games, and
 * their hours change too: leave out events of a game whose `type` isn't
 * "game". And if Steam couldn't be asked when a game was moved back to it,
 * its total arrives with the next sync, by itself, and reads as played then.
 */
export function playsOf(events: readonly HistoryEvent[]): Play[] {
  const plays: Play[] = [];
  for (const event of events) {
    const hours = event.changes.playtime_forever;
    if (!hours || event.kind === 'added' || 'platform' in event.changes) continue;
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
